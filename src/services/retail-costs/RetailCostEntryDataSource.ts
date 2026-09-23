import type { RetailCostEntry, RetailCostEntryDraft } from '@/types/data';
import { assertFirestoreUid } from '@/services/database/firestorePaths';

import { retailCostEntryCatalogCache } from './RetailCostEntryCatalogCache';
import {
  isStrictRetailIsoDate,
  normalizeRetailDate,
  normalizeRetailMoney,
  normalizeRetailQuantity,
  optionalRetailText,
  retailUnitsMatch,
} from './retailCostUtils';

type RetailCostEntryDocument = {
  entryId?: string;
  effectiveDate: string;
  purchasedQuantity: number;
  purchaseTotalCost: number;
  normalizedUnitCost: number;
  unit: string;
  supplier?: string;
  createdAt?: unknown;
};

export type RetailCostEntryRecord = RetailCostEntryDocument & { id: string };

type SessionRequest = {
  userId: string;
  generation: number;
  sessionVersion?: number;
};

type FirestoreOps = Pick<
  typeof import('firebase/firestore'),
  'collection' | 'doc' | 'getDocs' | 'serverTimestamp' | 'setDoc' | 'updateDoc'
>;

let firestoreOpsOverride: FirestoreOps | undefined;
let firestoreDbOverride: unknown | undefined;

export function setFirestoreRetailCostEntryDataSourceOpsForTesting(
  ops: FirestoreOps | undefined,
  db?: unknown,
): void {
  firestoreOpsOverride = ops;
  firestoreDbOverride = db;
}

async function getFirestoreOps(): Promise<FirestoreOps> {
  if (firestoreOpsOverride) return firestoreOpsOverride;
  return import('firebase/firestore');
}

async function collectionFor(uid: string, costItemId: string) {
  assertFirestoreUid(uid);
  assertId(costItemId);
  const { collection } = await getFirestoreOps();
  if (firestoreDbOverride) {
    return collection(
      firestoreDbOverride as never,
      'users',
      uid,
      'retailCostItems',
      costItemId,
      'costEntries',
    );
  }
  const { getFirebaseFirestore } = await import('@/services/firebase/firestore');
  return collection(
    getFirebaseFirestore(),
    'users',
    uid,
    'retailCostItems',
    costItemId,
    'costEntries',
  );
}

function recordFromDocument(id: string, data: Record<string, unknown>): RetailCostEntryRecord {
  return { id, ...(data as RetailCostEntryDocument) };
}

function documentToEntry(record: RetailCostEntryRecord): RetailCostEntry | undefined {
  if (
    !record.id ||
    typeof record.effectiveDate !== 'string' ||
    !isStrictRetailIsoDate(record.effectiveDate) ||
    !Number.isFinite(record.purchasedQuantity) ||
    record.purchasedQuantity <= 0 ||
    !Number.isFinite(record.purchaseTotalCost) ||
    record.purchaseTotalCost < 0 ||
    !Number.isFinite(record.normalizedUnitCost) ||
    record.normalizedUnitCost < 0 ||
    typeof record.unit !== 'string' ||
    !record.unit.trim()
  ) {
    return undefined;
  }
  return {
    createdAt: record.createdAt as RetailCostEntry['createdAt'],
    effectiveDate: record.effectiveDate,
    entryId: record.id,
    normalizedUnitCost: record.normalizedUnitCost,
    purchaseTotalCost: record.purchaseTotalCost,
    purchasedQuantity: record.purchasedQuantity,
    ...(record.supplier?.trim() ? { supplier: record.supplier.trim() } : {}),
    unit: record.unit.trim(),
  };
}

function snapshotForRecords(records: readonly RetailCostEntryRecord[]): readonly RetailCostEntry[] {
  return records.flatMap((record) => {
    const entry = documentToEntry(record);
    return entry ? [entry] : [];
  });
}

function sortEntries(entries: readonly RetailCostEntry[]): RetailCostEntry[] {
  return entries
    .slice()
    .sort(
      (left, right) =>
        right.effectiveDate.localeCompare(left.effectiveDate) ||
        right.entryId.localeCompare(left.entryId),
    );
}

export class RetailCostEntryDataSource {
  private recordsByItemId = new Map<string, RetailCostEntryRecord[]>();
  private snapshotsByItemId = new Map<string, readonly RetailCostEntry[]>();
  private readonly listeners = new Set<() => void>();
  private activeUid?: string;
  private sessionUid: string | null | undefined;
  private sessionGeneration = 0;
  private boundSessionVersion: number | undefined;
  private loadEpoch = 0;
  private readonly inFlightHydrations = new Map<string, Promise<boolean>>();
  private readonly inFlightLoads = new Map<string, Promise<void>>();

  public getSnapshot = (
    costItemId: string,
    userId?: string,
    sessionVersion?: number,
  ): readonly RetailCostEntry[] | null => {
    if (!this.isSessionVisible(userId, sessionVersion)) return null;
    return this.snapshotsByItemId.get(costItemId) ?? null;
  };

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public setSessionUser(userId?: string, sessionVersion?: number): void {
    const nextSessionUid = userId ?? null;
    if (
      this.sessionUid === nextSessionUid &&
      (sessionVersion === undefined || this.boundSessionVersion === sessionVersion)
    ) {
      return;
    }
    this.sessionUid = nextSessionUid;
    this.boundSessionVersion = sessionVersion;
    this.sessionGeneration += 1;
    this.loadEpoch += 1;
    this.activeUid = userId;
    this.recordsByItemId.clear();
    this.snapshotsByItemId.clear();
    this.publish();
  }

  public async hydrateFromCache(
    costItemId: string,
    userId: string,
    sessionVersion?: number,
  ): Promise<boolean> {
    assertId(costItemId);
    const generation = this.beginSessionRequest(userId, sessionVersion);
    if (generation === null) return false;
    const key = this.itemRequestKey(userId, generation, costItemId);
    const existing = this.inFlightHydrations.get(key);
    if (existing) return existing;
    const epoch = this.loadEpoch;
    const hydration = this.hydrateFromCacheInternal(
      costItemId,
      userId,
      generation,
      sessionVersion,
      epoch,
    );
    this.inFlightHydrations.set(key, hydration);
    void hydration.then(
      () => {
        if (this.inFlightHydrations.get(key) === hydration) this.inFlightHydrations.delete(key);
      },
      () => {
        if (this.inFlightHydrations.get(key) === hydration) this.inFlightHydrations.delete(key);
      },
    );
    return hydration;
  }

  private async hydrateFromCacheInternal(
    costItemId: string,
    userId: string,
    generation: number,
    sessionVersion: number | undefined,
    epoch: number,
  ): Promise<boolean> {
    const cachedRecords = await retailCostEntryCatalogCache.read(userId, costItemId);
    if (
      !this.isSessionRequestCurrent(userId, generation, sessionVersion) ||
      this.loadEpoch !== epoch ||
      this.snapshotsByItemId.has(costItemId)
    ) {
      return false;
    }
    if (!cachedRecords) return false;
    this.recordsByItemId.set(costItemId, cachedRecords);
    this.snapshotsByItemId.set(costItemId, sortEntries(snapshotForRecords(cachedRecords)));
    this.publish();
    return true;
  }

  public async load(costItemId: string, userId?: string, sessionVersion?: number): Promise<void> {
    if (!userId) throw new Error('Sessão não disponível.');
    assertId(costItemId);
    const generation = this.beginSessionRequest(userId, sessionVersion);
    if (generation === null) return;
    const epoch = this.loadEpoch;
    const key = `${this.itemRequestKey(userId, generation, costItemId)}:${epoch}`;
    const existing = this.inFlightLoads.get(key);
    if (existing) return existing;
    const load = this.loadFromFirestore(costItemId, userId, generation, sessionVersion, epoch);
    this.inFlightLoads.set(key, load);
    void load.then(
      () => {
        if (this.inFlightLoads.get(key) === load) this.inFlightLoads.delete(key);
      },
      () => {
        if (this.inFlightLoads.get(key) === load) this.inFlightLoads.delete(key);
      },
    );
    return load;
  }

  private async loadFromFirestore(
    costItemId: string,
    userId: string,
    generation: number,
    sessionVersion: number | undefined,
    epoch: number,
  ): Promise<void> {
    await this.hydrateFromCache(costItemId, userId, sessionVersion);
    if (
      !this.isSessionRequestCurrent(userId, generation, sessionVersion) ||
      this.loadEpoch !== epoch
    ) {
      return;
    }
    try {
      const { getDocs } = await getFirestoreOps();
      const result = await getDocs(await collectionFor(userId, costItemId));
      if (
        !this.isSessionRequestCurrent(userId, generation, sessionVersion) ||
        this.loadEpoch !== epoch
      ) {
        return;
      }
      const loadedRecords = result.docs.map((item) =>
        recordFromDocument(item.id, item.data() as Record<string, unknown>),
      );
      const currentRecords =
        result.metadata?.fromCache === true
          ? [
              ...new Map([
                ...(this.recordsByItemId.get(costItemId) ?? []).map(
                  (record) => [record.id, record] as const,
                ),
                ...loadedRecords.map((record) => [record.id, record] as const),
              ]).values(),
            ]
          : loadedRecords;
      this.recordsByItemId.set(costItemId, currentRecords);
      this.snapshotsByItemId.set(costItemId, sortEntries(snapshotForRecords(currentRecords)));
      if (result.metadata?.fromCache !== true) {
        void retailCostEntryCatalogCache
          .write(userId, costItemId, currentRecords)
          .catch(() => undefined);
      }
      this.publish();
    } catch (error) {
      if (
        !this.isSessionRequestCurrent(userId, generation, sessionVersion) ||
        this.loadEpoch !== epoch
      ) {
        return;
      }
      throw error;
    }
  }

  public list(costItemId: string, userId?: string, sessionVersion?: number): RetailCostEntry[] {
    if (!this.isSessionVisible(userId, sessionVersion)) return [];
    return sortEntries(this.snapshotsByItemId.get(costItemId) ?? []);
  }

  public async create(
    userId: string | undefined,
    costItemId: string,
    itemUnit: string,
    input: RetailCostEntryDraft,
    sessionVersion?: number,
  ): Promise<void> {
    const request = this.captureSessionRequest(userId, sessionVersion);
    assertId(costItemId);
    const unit = itemUnit.trim();
    if (!unit) throw new Error('A unidade-base do item de custo é obrigatória.');
    if (input.unit !== undefined && !retailUnitsMatch(input.unit, unit)) {
      throw new Error('A unidade da entrada deve corresponder à unidade-base do item.');
    }
    const effectiveDate = normalizeRetailDate(input.effectiveDate);
    const purchasedQuantity = normalizeRetailQuantity(
      input.purchasedQuantity,
      'A quantidade comprada',
    );
    const purchaseTotalCost = normalizeRetailMoney(
      input.purchaseTotalCost,
      'O custo total da compra',
    );
    const normalizedUnitCost = purchaseTotalCost / purchasedQuantity;
    const { doc, serverTimestamp, setDoc } = await getFirestoreOps();
    this.assertSessionRequestCurrent(request);
    const reference = doc(await collectionFor(request.userId, costItemId));
    await setDoc(reference, {
      createdAt: serverTimestamp(),
      effectiveDate,
      entryId: reference.id,
      normalizedUnitCost,
      purchaseTotalCost,
      purchasedQuantity,
      ...(optionalRetailText(input.supplier)
        ? { supplier: optionalRetailText(input.supplier) }
        : {}),
      unit,
    });
    this.assertSessionRequestCurrent(request);
    const currentRecords = this.recordsByItemId.get(costItemId) ?? [];
    const localRecord: RetailCostEntryRecord = {
      createdAt: undefined,
      effectiveDate,
      id: reference.id,
      normalizedUnitCost,
      purchaseTotalCost,
      purchasedQuantity,
      ...(optionalRetailText(input.supplier)
        ? { supplier: optionalRetailText(input.supplier) }
        : {}),
      unit,
    };
    const nextRecords = [
      ...currentRecords.filter((record) => record.id !== reference.id),
      localRecord,
    ];
    this.recordsByItemId.set(costItemId, nextRecords);
    this.snapshotsByItemId.set(costItemId, sortEntries(snapshotForRecords(nextRecords)));
    this.publish();
    void retailCostEntryCatalogCache
      .write(request.userId, costItemId, nextRecords)
      .catch(() => undefined);
  }

  public async updateEffectiveDate(
    userId: string | undefined,
    costItemId: string,
    entryId: string,
    effectiveDate: string,
    sessionVersion?: number,
  ): Promise<void> {
    const request = this.captureSessionRequest(userId, sessionVersion);
    assertId(costItemId);
    assertId(entryId);
    const normalizedEffectiveDate = normalizeRetailDate(effectiveDate);
    const currentRecords = this.recordsByItemId.get(costItemId) ?? [];
    const currentRecord = currentRecords.find((record) => record.id === entryId);
    if (!currentRecord) throw new Error('Entrada de custo não encontrada.');

    const { doc, updateDoc } = await getFirestoreOps();
    this.assertSessionRequestCurrent(request);
    await updateDoc(doc(await collectionFor(request.userId, costItemId), entryId), {
      effectiveDate: normalizedEffectiveDate,
    });
    this.assertSessionRequestCurrent(request);

    const nextRecords = currentRecords.map((record) =>
      record.id === entryId ? { ...record, effectiveDate: normalizedEffectiveDate } : record,
    );
    this.recordsByItemId.set(costItemId, nextRecords);
    this.snapshotsByItemId.set(costItemId, sortEntries(snapshotForRecords(nextRecords)));
    this.publish();
    void retailCostEntryCatalogCache
      .write(request.userId, costItemId, nextRecords)
      .catch(() => undefined);
  }

  private captureSessionRequest(
    userId: string | undefined,
    sessionVersion?: number,
  ): SessionRequest {
    if (!userId) throw new Error('Sessão não disponível.');
    const generation = this.beginSessionRequest(userId, sessionVersion);
    if (generation === null) throw new Error('Sessão alterada durante a operação.');
    this.loadEpoch += 1;
    return { generation, sessionVersion: this.boundSessionVersion, userId };
  }

  private beginSessionRequest(userId: string, sessionVersion?: number): number | null {
    if (this.sessionUid !== undefined && this.sessionUid !== userId) return null;
    if (
      this.boundSessionVersion !== undefined &&
      sessionVersion !== undefined &&
      this.boundSessionVersion !== sessionVersion
    ) {
      return null;
    }
    if (sessionVersion !== undefined) this.boundSessionVersion = sessionVersion;
    this.activeUid = userId;
    if (this.sessionUid === undefined) this.sessionUid = userId;
    return this.sessionGeneration;
  }

  private isSessionRequestCurrent(
    userId: string,
    generation: number,
    sessionVersion?: number,
  ): boolean {
    return (
      (this.sessionUid === undefined || this.sessionUid === userId) &&
      this.sessionGeneration === generation &&
      (sessionVersion === undefined || this.boundSessionVersion === sessionVersion)
    );
  }

  private isSessionVisible(userId?: string, sessionVersion?: number): boolean {
    return (
      (this.sessionUid === undefined || this.sessionUid === (userId ?? null)) &&
      (this.sessionUid !== undefined ||
        this.activeUid === undefined ||
        this.activeUid === userId) &&
      (sessionVersion === undefined || this.boundSessionVersion === sessionVersion)
    );
  }

  private assertSessionRequestCurrent(request: SessionRequest): void {
    if (!this.isSessionRequestCurrent(request.userId, request.generation, request.sessionVersion)) {
      throw new Error('Sessão alterada durante a operação.');
    }
  }

  private itemRequestKey(userId: string, generation: number, costItemId: string): string {
    return `${userId}:${generation}:${costItemId}`;
  }

  private publish(): void {
    this.listeners.forEach((listener) => listener());
  }
}

function assertId(value: string): void {
  if (!value.trim() || value.includes('/')) throw new Error('ID de item de custo inválido.');
}

export const retailCostEntryDataSource = new RetailCostEntryDataSource();
