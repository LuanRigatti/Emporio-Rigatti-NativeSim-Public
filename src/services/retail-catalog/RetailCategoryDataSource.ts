import type {
  RetailCategory,
  RetailCategoryDraft,
  RetailCategoryPatch,
  RetailFinanceGroup,
} from '@/types/data';
import { assertFirestoreUid } from '@/services/database/firestorePaths';
import { normalizeClientKey } from '@/utils/data';

import { retailCategoryCatalogCache } from './RetailCategoryCatalogCache';
import { isRetailFinanceGroup, legacyRetailFinanceGroupForLabel } from './retailFinanceGroup';

type RetailCategoryDocument = {
  categoryId?: string;
  label: string;
  normalizedLabel: string;
  financeGroup?: RetailFinanceGroup;
  active: boolean;
  sortOrder?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type RetailCategoryRecord = RetailCategoryDocument & { id: string };

export interface RetailCategoryQuery {
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

export function setFirestoreRetailCategoryDataSourceOpsForTesting(
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
    return collection(firestoreDbOverride as never, 'users', uid, 'retailCategories');
  }
  const { getFirebaseFirestore } = await import('@/services/firebase/firestore');
  return collection(getFirebaseFirestore(), 'users', uid, 'retailCategories');
}

function normalizeDraft(input: RetailCategoryDraft): {
  label: string;
  normalizedLabel: string;
  financeGroup: RetailFinanceGroup;
  active: boolean;
  sortOrder?: number;
} {
  const label = input.label.trim();
  const normalizedLabel = normalizeClientKey(label);
  if (!label || !normalizedLabel) throw new Error('Informe o nome da categoria.');
  if (input.sortOrder !== undefined && (!Number.isFinite(input.sortOrder) || input.sortOrder < 0)) {
    throw new Error('A ordem da categoria deve ser zero ou maior.');
  }
  return {
    active: input.active ?? true,
    financeGroup: input.financeGroup ?? legacyRetailFinanceGroupForLabel(normalizedLabel),
    label,
    normalizedLabel,
    ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
  };
}

function documentToCategory(record: RetailCategoryRecord): RetailCategory | undefined {
  const label = record.label.trim();
  const normalizedLabel = normalizeClientKey(label);
  if (!record.id || !label || !normalizedLabel || typeof record.active !== 'boolean') {
    return undefined;
  }
  return {
    active: record.active,
    categoryId: record.id,
    createdAt: record.createdAt as RetailCategory['createdAt'],
    ...(isRetailFinanceGroup(record.financeGroup) ? { financeGroup: record.financeGroup } : {}),
    label,
    normalizedLabel,
    ...(typeof record.sortOrder === 'number' && Number.isFinite(record.sortOrder)
      ? { sortOrder: record.sortOrder }
      : {}),
    updatedAt: record.updatedAt as RetailCategory['updatedAt'],
  };
}

function snapshotForRecords(records: readonly RetailCategoryRecord[]): readonly RetailCategory[] {
  return records.flatMap((record) => {
    const category = documentToCategory(record);
    return category ? [category] : [];
  });
}

function recordFromDocument(id: string, data: Record<string, unknown>): RetailCategoryRecord {
  return { id, ...(data as RetailCategoryDocument) };
}

export const INITIAL_RETAIL_CATEGORIES = [
  { label: 'Cestas', normalizedLabel: 'cestas', sortOrder: 0 },
  { label: 'Salgados', normalizedLabel: 'salgados', sortOrder: 1 },
  { label: 'Baldes', normalizedLabel: 'baldes', sortOrder: 2 },
] as const;

export class RetailCategoryDataSource {
  private records: RetailCategoryRecord[] = [];
  private snapshot: readonly RetailCategory[] | null = null;
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
  ): readonly RetailCategory[] | null => {
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
    const sessionGeneration = this.beginSessionRequest(userId, sessionVersion);
    if (sessionGeneration === null) return false;
    if (this.lastAppliedSource !== null) return false;
    const key = this.requestKey(userId, sessionGeneration);
    const existing = this.inFlightHydrations.get(key);
    if (existing) return existing;
    const hydration = this.hydrateFromCacheInternal(userId, sessionGeneration, sessionVersion);
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
    sessionGeneration: number,
    sessionVersion?: number,
  ): Promise<boolean> {
    const cachedRecords = await retailCategoryCatalogCache.read(userId);
    if (
      !this.isSessionRequestCurrent(userId, sessionGeneration, sessionVersion) ||
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
    const sessionGeneration = this.beginSessionRequest(userId, sessionVersion);
    if (sessionGeneration === null) return;
    const key = this.requestKey(userId, sessionGeneration);
    const existing = this.inFlightLoads.get(key);
    if (existing) return existing;
    const load = this.loadFromFirestore(userId, sessionGeneration, sessionVersion);
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
    sessionGeneration: number,
    sessionVersion?: number,
  ): Promise<void> {
    await this.hydrateFromCache(userId, sessionVersion);
    if (!this.isSessionRequestCurrent(userId, sessionGeneration, sessionVersion)) return;
    const loadEpoch = this.loadEpoch;
    try {
      const { getDocs } = await getFirestoreOps();
      const result = await getDocs(await collectionFor(userId));
      if (
        !this.isSessionRequestCurrent(userId, sessionGeneration, sessionVersion) ||
        this.loadEpoch !== loadEpoch
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
        void retailCategoryCatalogCache.write(userId, this.records).catch(() => undefined);
      }
      this.publish();
    } catch (error) {
      if (
        !this.isSessionRequestCurrent(userId, sessionGeneration, sessionVersion) ||
        this.loadEpoch !== loadEpoch
      ) {
        return;
      }
      throw error;
    }
  }

  public list(
    query: RetailCategoryQuery = {},
    userId?: string,
    sessionVersion?: number,
  ): RetailCategory[] {
    if (!this.isSessionVisible(userId, sessionVersion) || !this.snapshot) return [];
    const normalizedSearch = query.search ? normalizeClientKey(query.search) : '';
    return this.snapshot
      .filter((category) => query.includeInactive === true || category.active)
      .filter(
        (category) => !normalizedSearch || category.normalizedLabel.includes(normalizedSearch),
      )
      .slice()
      .sort(
        (left, right) =>
          (left.sortOrder ?? Number.MAX_SAFE_INTEGER) -
            (right.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
          left.normalizedLabel.localeCompare(right.normalizedLabel, 'pt-BR') ||
          left.categoryId.localeCompare(right.categoryId),
      );
  }

  public getById(
    categoryId: string,
    userId?: string,
    sessionVersion?: number,
  ): RetailCategory | undefined {
    if (!this.isSessionVisible(userId, sessionVersion)) return undefined;
    return this.snapshot?.find((category) => category.categoryId === categoryId);
  }

  public async create(
    userId: string | undefined,
    input: RetailCategoryDraft,
    sessionVersion?: number,
  ): Promise<void> {
    const request = this.captureSessionRequest(userId, sessionVersion);
    const normalized = normalizeDraft(input);
    if (
      this.list({ includeInactive: true }, request.userId, request.sessionVersion).some(
        (category) => category.normalizedLabel === normalized.normalizedLabel,
      )
    ) {
      throw new Error('Já existe uma categoria Varejo com esse nome.');
    }
    const { doc, serverTimestamp, setDoc } = await getFirestoreOps();
    this.assertSessionRequestCurrent(request);
    const reference = doc(await collectionFor(request.userId));
    await setDoc(reference, {
      ...normalized,
      categoryId: reference.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    this.assertSessionRequestCurrent(request);
    this.applyLocalRecords([
      ...this.records.filter((record) => record.id !== reference.id),
      { id: reference.id, ...normalized, categoryId: reference.id },
    ]);
  }

  public async ensureInitialCategories(
    userId: string | undefined,
    sessionVersion?: number,
  ): Promise<void> {
    const request = this.captureSessionRequest(userId, sessionVersion);
    await this.load(request.userId, request.sessionVersion);
    for (const category of INITIAL_RETAIL_CATEGORIES) {
      this.assertSessionRequestCurrent(request);
      if (
        this.list({ includeInactive: true }, request.userId, request.sessionVersion).some(
          (current) => current.normalizedLabel === category.normalizedLabel,
        )
      ) {
        continue;
      }
      await this.create(
        request.userId,
        {
          financeGroup: legacyRetailFinanceGroupForLabel(category.normalizedLabel),
          label: category.label,
          sortOrder: category.sortOrder,
        },
        request.sessionVersion,
      );
    }
  }

  public async update(
    userId: string | undefined,
    categoryId: string,
    patch: RetailCategoryPatch,
    sessionVersion?: number,
  ): Promise<void> {
    const request = this.captureSessionRequest(userId, sessionVersion);
    if (!categoryId.trim() || categoryId.includes('/'))
      throw new Error('ID de categoria inválido.');
    const current = this.getById(categoryId, request.userId, request.sessionVersion);
    if (!current) throw new Error('Categoria Varejo não encontrada.');
    const firestorePatch: Record<string, unknown> = {};
    if (patch.label !== undefined) {
      const normalized = normalizeDraft({ label: patch.label, active: current.active });
      if (
        this.list({ includeInactive: true }, request.userId, request.sessionVersion).some(
          (category) =>
            category.categoryId !== categoryId &&
            category.normalizedLabel === normalized.normalizedLabel,
        )
      ) {
        throw new Error('Já existe uma categoria Varejo com esse nome.');
      }
      firestorePatch.label = normalized.label;
      firestorePatch.normalizedLabel = normalized.normalizedLabel;
    }
    if (patch.financeGroup !== undefined) {
      if (!isRetailFinanceGroup(patch.financeGroup)) {
        throw new Error('Grupo financeiro inválido.');
      }
      firestorePatch.financeGroup = patch.financeGroup;
    }
    if (patch.sortOrder !== undefined) {
      if (patch.sortOrder !== null && (!Number.isFinite(patch.sortOrder) || patch.sortOrder < 0)) {
        throw new Error('A ordem da categoria deve ser zero ou maior.');
      }
      firestorePatch.sortOrder =
        patch.sortOrder === null ? (await getFirestoreOps()).deleteField() : patch.sortOrder;
    }
    if (patch.active !== undefined) firestorePatch.active = patch.active;
    firestorePatch.updatedAt = (await getFirestoreOps()).serverTimestamp();
    this.assertSessionRequestCurrent(request);
    const { doc, updateDoc } = await getFirestoreOps();
    await updateDoc(doc(await collectionFor(request.userId), categoryId), firestorePatch);
    this.assertSessionRequestCurrent(request);
    const currentRecord = this.records.find((record) => record.id === categoryId);
    if (!currentRecord) throw new Error('Categoria Varejo não encontrada.');
    const nextRecord: RetailCategoryRecord = { ...currentRecord };
    if (patch.label !== undefined) {
      const normalized = normalizeDraft({ label: patch.label, active: currentRecord.active });
      nextRecord.label = normalized.label;
      nextRecord.normalizedLabel = normalized.normalizedLabel;
    }
    if (patch.financeGroup !== undefined) nextRecord.financeGroup = patch.financeGroup;
    if (patch.sortOrder !== undefined) {
      if (patch.sortOrder === null) delete nextRecord.sortOrder;
      else nextRecord.sortOrder = patch.sortOrder;
    }
    if (patch.active !== undefined) nextRecord.active = patch.active;
    this.applyLocalRecords(
      this.records.map((record) => (record.id === categoryId ? nextRecord : record)),
    );
  }

  public async remove(
    userId: string | undefined,
    categoryId: string,
    sessionVersion?: number,
  ): Promise<void> {
    await this.update(userId, categoryId, { active: false }, sessionVersion);
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
    if (this.boundSessionVersion !== undefined && sessionVersion !== undefined) {
      if (this.boundSessionVersion !== sessionVersion) return null;
    } else if (sessionVersion !== undefined) {
      this.boundSessionVersion = sessionVersion;
    }
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

  private applyLocalRecords(records: RetailCategoryRecord[]): void {
    this.records = records;
    this.snapshot = snapshotForRecords(this.records);
    this.lastAppliedSource = 'local';
    this.publish();
    if (this.activeUid) {
      void retailCategoryCatalogCache.write(this.activeUid, this.records).catch(() => undefined);
    }
  }

  private requestKey(userId: string, generation: number): string {
    return `${userId}:${generation}`;
  }

  private publish(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const retailCategoryDataSource = new RetailCategoryDataSource();
