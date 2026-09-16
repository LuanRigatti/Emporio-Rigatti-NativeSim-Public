import type { RetailCostItem, RetailCostItemDraft, RetailCostItemPatch } from '@/types/data';
import { assertFirestoreUid } from '@/services/database/firestorePaths';
import { normalizeClientKey } from '@/utils/data';

import { retailCostItemCatalogCache } from './RetailCostItemCatalogCache';
import {
  normalizeRetailName,
  normalizeRetailUnit,
  optionalRetailText,
  retailUnitsMatch,
} from './retailCostUtils';

type RetailCostItemDocument = {
  costItemId?: string;
  name: string;
  normalizedName: string;
  unit: string;
  supplier?: string;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type RetailCostItemRecord = RetailCostItemDocument & { id: string };

export interface RetailCostItemQuery {
  search?: string;
  includeInactive?: boolean;
}

type SessionRequest = {
  userId: string;
  generation: number;
  sessionVersion?: number;
};

type FirestoreOps = Pick<
  typeof import('firebase/firestore'),
  'collection' | 'deleteField' | 'doc' | 'getDocs' | 'serverTimestamp' | 'setDoc' | 'updateDoc'
>;

let firestoreOpsOverride: FirestoreOps | undefined;
let firestoreDbOverride: unknown | undefined;

export function setFirestoreRetailCostItemDataSourceOpsForTesting(
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

async function collectionFor(uid: string) {
  assertFirestoreUid(uid);
  const { collection } = await getFirestoreOps();
  if (firestoreDbOverride) {
    return collection(firestoreDbOverride as never, 'users', uid, 'retailCostItems');
  }
  const { getFirebaseFirestore } = await import('@/services/firebase/firestore');
  return collection(getFirebaseFirestore(), 'users', uid, 'retailCostItems');
}

function documentToItem(record: RetailCostItemRecord): RetailCostItem | undefined {
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const unit = typeof record.unit === 'string' ? record.unit.trim() : '';
  const normalizedName = name ? normalizeClientKey(name) : '';
  if (!record.id || !name || !unit || !normalizedName || typeof record.active !== 'boolean') {
    return undefined;
  }
  return {
    active: record.active,
    costItemId: record.id,
    createdAt: record.createdAt as RetailCostItem['createdAt'],
    name,
    normalizedName,
    ...(record.supplier?.trim() ? { supplier: record.supplier.trim() } : {}),
    unit,
    updatedAt: record.updatedAt as RetailCostItem['updatedAt'],
  };
}

function recordFromDocument(id: string, data: Record<string, unknown>): RetailCostItemRecord {
  return { id, ...(data as RetailCostItemDocument) };
}

function snapshotForRecords(records: readonly RetailCostItemRecord[]): readonly RetailCostItem[] {
  return records.flatMap((record) => {
    const item = documentToItem(record);
    return item ? [item] : [];
  });
}

export class RetailCostItemDataSource {
  private records: RetailCostItemRecord[] = [];
  private snapshot: readonly RetailCostItem[] | null = null;
  private readonly listeners = new Set<() => void>();
  private activeUid?: string;
  private sessionUid: string | null | undefined;
  private sessionGeneration = 0;
  private boundSessionVersion: number | undefined;
  private loadEpoch = 0;
  private lastAppliedSource: 'cache' | 'remote' | 'local' | null = null;
  private readonly inFlightHydrations = new Map<string, Promise<boolean>>();
  private readonly inFlightLoads = new Map<string, Promise<void>>();

  public getSnapshot = (
    userId?: string,
    sessionVersion?: number,
  ): readonly RetailCostItem[] | null => {
    if (!this.isSessionVisible(userId, sessionVersion)) return null;
    return this.snapshot;
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
    this.records = [];
    this.snapshot = null;
    this.lastAppliedSource = null;
    this.publish();
  }

  public async hydrateFromCache(userId: string, sessionVersion?: number): Promise<boolean> {
    const generation = this.beginSessionRequest(userId, sessionVersion);
    if (generation === null || this.lastAppliedSource !== null) return false;
    const key = this.requestKey(userId, generation);
    const existing = this.inFlightHydrations.get(key);
    if (existing) return existing;
    const epoch = this.loadEpoch;
    const hydration = this.hydrateFromCacheInternal(userId, generation, sessionVersion, epoch);
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
    userId: string,
    generation: number,
    sessionVersion: number | undefined,
    epoch: number,
  ): Promise<boolean> {
    const cachedRecords = await retailCostItemCatalogCache.read(userId);
    if (
      !this.isSessionRequestCurrent(userId, generation, sessionVersion) ||
      this.loadEpoch !== epoch ||
      this.lastAppliedSource !== null
    ) {
      return false;
    }
    if (!cachedRecords?.length) return false;
    this.records = cachedRecords;
    this.snapshot = snapshotForRecords(this.records);
    this.lastAppliedSource = 'cache';
    this.publish();
    return true;
  }

  public async load(userId?: string, sessionVersion?: number): Promise<void> {
    if (!userId) throw new Error('Sessão não disponível.');
    const generation = this.beginSessionRequest(userId, sessionVersion);
    if (generation === null) return;
    const epoch = this.loadEpoch;
    const key = `${this.requestKey(userId, generation)}:${epoch}`;
    const existing = this.inFlightLoads.get(key);
    if (existing) return existing;
    const load = this.loadFromFirestore(userId, generation, sessionVersion, epoch);
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
    userId: string,
    generation: number,
    sessionVersion: number | undefined,
    epoch: number,
  ): Promise<void> {
    await this.hydrateFromCache(userId, sessionVersion);
    if (
      !this.isSessionRequestCurrent(userId, generation, sessionVersion) ||
      this.loadEpoch !== epoch
    ) {
      return;
    }
    try {
      const { getDocs } = await getFirestoreOps();
      const result = await getDocs(await collectionFor(userId));
      if (
        !this.isSessionRequestCurrent(userId, generation, sessionVersion) ||
        this.loadEpoch !== epoch
      ) {
        return;
      }
      const loadedRecords = result.docs.map((item) =>
        recordFromDocument(item.id, item.data() as Record<string, unknown>),
      );
      if (result.metadata?.fromCache === true) {
        const recordsById = new Map(this.records.map((record) => [record.id, record]));
        loadedRecords.forEach((record) => recordsById.set(record.id, record));
        this.records = [...recordsById.values()];
      } else {
        this.records = loadedRecords;
      }
      this.snapshot = snapshotForRecords(this.records);
      this.lastAppliedSource = result.metadata?.fromCache === true ? 'cache' : 'remote';
      if (result.metadata?.fromCache !== true) {
        void retailCostItemCatalogCache.write(userId, this.records).catch(() => undefined);
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

  public list(
    query: RetailCostItemQuery = {},
    userId?: string,
    sessionVersion?: number,
  ): RetailCostItem[] {
    if (!this.isSessionVisible(userId, sessionVersion) || !this.snapshot) return [];
    const normalizedSearch = query.search ? normalizeClientKey(query.search) : '';
    return this.snapshot
      .filter((item) => query.includeInactive === true || item.active)
      .filter((item) => !normalizedSearch || item.normalizedName.includes(normalizedSearch))
      .slice()
      .sort(
        (left, right) =>
          left.normalizedName.localeCompare(right.normalizedName, 'pt-BR') ||
          left.costItemId.localeCompare(right.costItemId),
      );
  }

  public getById(
    costItemId: string,
    userId?: string,
    sessionVersion?: number,
  ): RetailCostItem | undefined {
    if (!this.isSessionVisible(userId, sessionVersion)) return undefined;
    return this.snapshot?.find((item) => item.costItemId === costItemId);
  }

  public async create(
    userId: string | undefined,
    input: RetailCostItemDraft,
    sessionVersion?: number,
  ): Promise<void> {
    const request = this.captureSessionRequest(userId, sessionVersion);
    const normalized = this.normalizeDraft(input);
    if (
      this.list({ includeInactive: true }, request.userId, request.sessionVersion).some(
        (item) => item.normalizedName === normalized.normalizedName,
      )
    ) {
      throw new Error('Já existe um item de custo Varejo com esse nome.');
    }
    const { doc, serverTimestamp, setDoc } = await getFirestoreOps();
    this.assertSessionRequestCurrent(request);
    const reference = doc(await collectionFor(request.userId));
    await setDoc(reference, {
      ...normalized,
      costItemId: reference.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    this.assertSessionRequestCurrent(request);
    this.applyLocalRecords([
      ...this.records.filter((record) => record.id !== reference.id),
      { id: reference.id, ...normalized, costItemId: reference.id },
    ]);
  }

  public async update(
    userId: string | undefined,
    costItemId: string,
    patch: RetailCostItemPatch,
    sessionVersion?: number,
  ): Promise<void> {
    const request = this.captureSessionRequest(userId, sessionVersion);
    this.assertId(costItemId);
    const current = this.getById(costItemId, request.userId, request.sessionVersion);
    if (!current) throw new Error('Item de custo Varejo não encontrado.');
    const firestorePatch: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      const normalized = normalizeRetailName(patch.name);
      if (
        this.list({ includeInactive: true }, request.userId, request.sessionVersion).some(
          (item) =>
            item.costItemId !== costItemId && item.normalizedName === normalized.normalizedName,
        )
      ) {
        throw new Error('Já existe um item de custo Varejo com esse nome.');
      }
      firestorePatch.name = normalized.name;
      firestorePatch.normalizedName = normalized.normalizedName;
    }
    if (patch.unit !== undefined && !retailUnitsMatch(patch.unit, current.unit)) {
      throw new Error('A unidade-base não pode ser alterada depois de criar o item de custo.');
    }
    if (patch.supplier !== undefined) {
      firestorePatch.supplier = patch.supplier?.trim()
        ? patch.supplier.trim()
        : (await getFirestoreOps()).deleteField();
    }
    if (patch.active !== undefined) firestorePatch.active = patch.active;
    firestorePatch.updatedAt = (await getFirestoreOps()).serverTimestamp();
    this.assertSessionRequestCurrent(request);
    const { doc, updateDoc } = await getFirestoreOps();
    await updateDoc(doc(await collectionFor(request.userId), costItemId), firestorePatch);
    this.assertSessionRequestCurrent(request);
    const currentRecord = this.records.find((record) => record.id === costItemId);
    if (!currentRecord) throw new Error('Item de custo Varejo não encontrado.');
    const nextRecord: RetailCostItemRecord = { ...currentRecord };
    if (patch.name !== undefined) {
      const normalized = normalizeRetailName(patch.name);
      nextRecord.name = normalized.name;
      nextRecord.normalizedName = normalized.normalizedName;
    }
    if (patch.supplier !== undefined) {
      const supplier = patch.supplier?.trim();
      if (supplier) nextRecord.supplier = supplier;
      else delete nextRecord.supplier;
    }
    if (patch.active !== undefined) nextRecord.active = patch.active;
    this.applyLocalRecords(
      this.records.map((record) => (record.id === costItemId ? nextRecord : record)),
    );
  }

  public async remove(
    userId: string | undefined,
    costItemId: string,
    sessionVersion?: number,
  ): Promise<void> {
    await this.update(userId, costItemId, { active: false }, sessionVersion);
  }

  private normalizeDraft(input: RetailCostItemDraft): {
    name: string;
    normalizedName: string;
    unit: string;
    supplier?: string;
    active: boolean;
  } {
    const name = normalizeRetailName(input.name);
    return {
      active: input.active ?? true,
      ...(optionalRetailText(input.supplier)
        ? { supplier: optionalRetailText(input.supplier) }
        : {}),
      name: name.name,
      normalizedName: name.normalizedName,
      unit: normalizeRetailUnit(input.unit),
    };
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

  private assertId(costItemId: string): void {
    if (!costItemId.trim() || costItemId.includes('/'))
      throw new Error('ID de item de custo inválido.');
  }

  private applyLocalRecords(records: RetailCostItemRecord[]): void {
    this.records = records;
    this.snapshot = snapshotForRecords(this.records);
    this.lastAppliedSource = 'local';
    this.publish();
    if (this.activeUid) {
      void retailCostItemCatalogCache.write(this.activeUid, this.records).catch(() => undefined);
    }
  }

  private requestKey(userId: string, generation: number): string {
    return `${userId}:${generation}`;
  }

  private publish(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const retailCostItemDataSource = new RetailCostItemDataSource();
