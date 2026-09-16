import type {
  RetailProduct,
  RetailProductCostMode,
  RetailProductDraft,
  RetailProductPatch,
} from '@/types/data';
import { assertFirestoreUid } from '@/services/database/firestorePaths';
import { normalizeClientKey } from '@/utils/data';

import { retailProductCatalogCache } from './RetailProductCatalogCache';

type RetailProductDocument = {
  productId?: string;
  skuCode?: string;
  categoryId: string;
  categoryName?: string;
  productName: string;
  variant?: string;
  flavor?: string;
  packageSize?: string;
  standardSalePrice: number;
  active: boolean;
  productFamilyId?: string;
  costMode?: RetailProductCostMode;
  directCostItemId?: string;
  compositionVersionId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type RetailProductRecord = RetailProductDocument & { id: string };

export interface RetailProductQuery {
  categoryId?: string;
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

export function setFirestoreRetailProductDataSourceOpsForTesting(
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
    return collection(firestoreDbOverride as never, 'users', uid, 'retailProducts');
  }
  const { getFirebaseFirestore } = await import('@/services/firebase/firestore');
  return collection(getFirebaseFirestore(), 'users', uid, 'retailProducts');
}

function trimOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function normalizeDraft(input: RetailProductDraft): RetailProductDocument {
  const categoryId = input.categoryId.trim();
  const productName = input.productName.trim();
  if (!categoryId) throw new Error('Selecione uma categoria.');
  if (!productName) throw new Error('Informe o nome do produto.');
  if (!Number.isFinite(input.standardSalePrice) || input.standardSalePrice < 0) {
    throw new Error('O preço de venda deve ser zero ou maior.');
  }
  if (input.costMode && input.costMode !== 'direct' && input.costMode !== 'composition') {
    throw new Error('Modo de custo inválido.');
  }
  return {
    active: input.active ?? true,
    categoryId,
    ...(trimOptionalText(input.categoryName)
      ? { categoryName: trimOptionalText(input.categoryName) }
      : {}),
    ...(trimOptionalText(input.compositionVersionId)
      ? { compositionVersionId: trimOptionalText(input.compositionVersionId) }
      : {}),
    ...(input.costMode ? { costMode: input.costMode } : {}),
    ...(trimOptionalText(input.directCostItemId)
      ? { directCostItemId: trimOptionalText(input.directCostItemId) }
      : {}),
    ...(trimOptionalText(input.flavor) ? { flavor: trimOptionalText(input.flavor) } : {}),
    ...(trimOptionalText(input.packageSize)
      ? { packageSize: trimOptionalText(input.packageSize) }
      : {}),
    productName,
    ...(trimOptionalText(input.productFamilyId)
      ? { productFamilyId: trimOptionalText(input.productFamilyId) }
      : {}),
    ...(trimOptionalText(input.skuCode) ? { skuCode: trimOptionalText(input.skuCode) } : {}),
    standardSalePrice: input.standardSalePrice,
    ...(trimOptionalText(input.variant) ? { variant: trimOptionalText(input.variant) } : {}),
  };
}

function documentToProduct(record: RetailProductRecord): RetailProduct | undefined {
  const categoryId = record.categoryId.trim();
  const productName = record.productName.trim();
  if (
    !record.id ||
    !categoryId ||
    !productName ||
    !Number.isFinite(record.standardSalePrice) ||
    record.standardSalePrice < 0 ||
    typeof record.active !== 'boolean'
  ) {
    return undefined;
  }
  return {
    active: record.active,
    categoryId,
    createdAt: record.createdAt as RetailProduct['createdAt'],
    ...(record.categoryName ? { categoryName: record.categoryName.trim() } : {}),
    ...(record.compositionVersionId ? { compositionVersionId: record.compositionVersionId } : {}),
    ...(record.costMode ? { costMode: record.costMode } : {}),
    ...(record.directCostItemId ? { directCostItemId: record.directCostItemId } : {}),
    ...(record.flavor ? { flavor: record.flavor } : {}),
    ...(record.packageSize ? { packageSize: record.packageSize } : {}),
    productFamilyId: record.productFamilyId,
    productId: record.id,
    ...(record.skuCode ? { skuCode: record.skuCode } : {}),
    productName,
    standardSalePrice: record.standardSalePrice,
    ...(record.variant ? { variant: record.variant } : {}),
    updatedAt: record.updatedAt as RetailProduct['updatedAt'],
  };
}

function snapshotForRecords(records: readonly RetailProductRecord[]): readonly RetailProduct[] {
  return records.flatMap((record) => {
    const product = documentToProduct(record);
    return product ? [product] : [];
  });
}

function recordFromDocument(id: string, data: Record<string, unknown>): RetailProductRecord {
  return { id, ...(data as RetailProductDocument) };
}

function optionalNormalized(value: string | undefined): string {
  return value ? normalizeClientKey(value) : '';
}

export class RetailProductDataSource {
  private records: RetailProductRecord[] = [];
  private snapshot: readonly RetailProduct[] | null = null;
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
  ): readonly RetailProduct[] | null => {
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
    const cachedRecords = await retailProductCatalogCache.read(userId);
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
        void retailProductCatalogCache.write(userId, this.records).catch(() => undefined);
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
    query: RetailProductQuery = {},
    userId?: string,
    sessionVersion?: number,
  ): RetailProduct[] {
    if (!this.isSessionVisible(userId, sessionVersion) || !this.snapshot) return [];
    const normalizedSearch = query.search ? normalizeClientKey(query.search) : '';
    return this.snapshot
      .filter((product) => query.includeInactive === true || product.active)
      .filter((product) => !query.categoryId || product.categoryId === query.categoryId)
      .filter(
        (product) =>
          !normalizedSearch ||
          normalizeClientKey(product.productName).includes(normalizedSearch) ||
          optionalNormalized(product.skuCode).includes(normalizedSearch),
      )
      .slice()
      .sort(
        (left, right) =>
          (left.categoryName ?? '').localeCompare(right.categoryName ?? '', 'pt-BR') ||
          left.categoryId.localeCompare(right.categoryId) ||
          normalizeClientKey(left.productName).localeCompare(
            normalizeClientKey(right.productName),
            'pt-BR',
          ) ||
          optionalNormalized(left.variant).localeCompare(
            optionalNormalized(right.variant),
            'pt-BR',
          ) ||
          optionalNormalized(left.flavor).localeCompare(
            optionalNormalized(right.flavor),
            'pt-BR',
          ) ||
          optionalNormalized(left.packageSize).localeCompare(
            optionalNormalized(right.packageSize),
            'pt-BR',
          ) ||
          left.productId.localeCompare(right.productId),
      );
  }

  public getById(
    productId: string,
    userId?: string,
    sessionVersion?: number,
  ): RetailProduct | undefined {
    if (!this.isSessionVisible(userId, sessionVersion)) return undefined;
    return this.snapshot?.find((product) => product.productId === productId);
  }

  public async create(
    userId: string | undefined,
    input: RetailProductDraft,
    sessionVersion?: number,
  ): Promise<void> {
    const request = this.captureSessionRequest(userId, sessionVersion);
    const normalized = normalizeDraft(input);
    const { doc, serverTimestamp, setDoc } = await getFirestoreOps();
    this.assertSessionRequestCurrent(request);
    const reference = doc(await collectionFor(request.userId));
    await setDoc(reference, {
      ...normalized,
      productId: reference.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    this.assertSessionRequestCurrent(request);
    this.applyLocalRecords([
      ...this.records.filter((record) => record.id !== reference.id),
      { id: reference.id, ...normalized, productId: reference.id },
    ]);
  }

  public async update(
    userId: string | undefined,
    productId: string,
    patch: RetailProductPatch,
    sessionVersion?: number,
  ): Promise<void> {
    const request = this.captureSessionRequest(userId, sessionVersion);
    if (!productId.trim() || productId.includes('/')) throw new Error('ID de produto inválido.');
    const current = this.getById(productId, request.userId, request.sessionVersion);
    if (!current) throw new Error('Produto Varejo não encontrado.');
    const firestorePatch: Record<string, unknown> = {};
    if (patch.categoryId !== undefined) {
      if (!patch.categoryId.trim()) throw new Error('Selecione uma categoria.');
      firestorePatch.categoryId = patch.categoryId.trim();
    }
    if (patch.categoryName !== undefined)
      firestorePatch.categoryName = await this.optionalField(patch.categoryName);
    if (patch.productName !== undefined) {
      const name = patch.productName.trim();
      if (!name) throw new Error('Informe o nome do produto.');
      firestorePatch.productName = name;
    }
    if (patch.standardSalePrice !== undefined) {
      if (!Number.isFinite(patch.standardSalePrice) || patch.standardSalePrice < 0) {
        throw new Error('O preço de venda deve ser zero ou maior.');
      }
      firestorePatch.standardSalePrice = patch.standardSalePrice;
    }
    for (const key of [
      'skuCode',
      'variant',
      'flavor',
      'packageSize',
      'productFamilyId',
      'directCostItemId',
      'compositionVersionId',
    ] as const) {
      if (patch[key] !== undefined)
        firestorePatch[key] = await this.optionalField(patch[key] ?? null);
    }
    if (patch.costMode !== undefined) {
      if (
        patch.costMode !== null &&
        patch.costMode !== 'direct' &&
        patch.costMode !== 'composition'
      ) {
        throw new Error('Modo de custo inválido.');
      }
      firestorePatch.costMode =
        patch.costMode === null ? (await getFirestoreOps()).deleteField() : patch.costMode;
    }
    if (patch.active !== undefined) firestorePatch.active = patch.active;
    firestorePatch.updatedAt = (await getFirestoreOps()).serverTimestamp();
    this.assertSessionRequestCurrent(request);
    const { doc, updateDoc } = await getFirestoreOps();
    await updateDoc(doc(await collectionFor(request.userId), productId), firestorePatch);
    this.assertSessionRequestCurrent(request);
    const currentRecord = this.records.find((record) => record.id === productId);
    if (!currentRecord) throw new Error('Produto Varejo não encontrado.');
    const nextRecord: RetailProductRecord = { ...currentRecord };
    if (patch.categoryId !== undefined) nextRecord.categoryId = patch.categoryId.trim();
    if (patch.categoryName !== undefined) {
      const categoryName = patch.categoryName?.trim();
      if (categoryName) nextRecord.categoryName = categoryName;
      else delete nextRecord.categoryName;
    }
    if (patch.productName !== undefined) nextRecord.productName = patch.productName.trim();
    if (patch.standardSalePrice !== undefined)
      nextRecord.standardSalePrice = patch.standardSalePrice;
    for (const key of [
      'skuCode',
      'variant',
      'flavor',
      'packageSize',
      'productFamilyId',
      'directCostItemId',
      'compositionVersionId',
    ] as const) {
      if (patch[key] !== undefined) {
        const value = patch[key]?.trim();
        if (value) nextRecord[key] = value;
        else delete nextRecord[key];
      }
    }
    if (patch.costMode !== undefined) {
      if (patch.costMode) nextRecord.costMode = patch.costMode;
      else delete nextRecord.costMode;
    }
    if (patch.active !== undefined) nextRecord.active = patch.active;
    this.applyLocalRecords(
      this.records.map((record) => (record.id === productId ? nextRecord : record)),
    );
  }

  public async remove(
    userId: string | undefined,
    productId: string,
    sessionVersion?: number,
  ): Promise<void> {
    await this.update(userId, productId, { active: false }, sessionVersion);
  }

  private async optionalField(value: string | null): Promise<unknown> {
    const trimmed = value?.trim();
    return trimmed ? trimmed : (await getFirestoreOps()).deleteField();
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

  private requestKey(userId: string, generation: number): string {
    return `${userId}:${generation}`;
  }

  private applyLocalRecords(records: RetailProductRecord[]): void {
    this.records = records;
    this.snapshot = snapshotForRecords(this.records);
    this.lastAppliedSource = 'local';
    this.publish();
    if (this.activeUid) {
      void retailProductCatalogCache.write(this.activeUid, this.records).catch(() => undefined);
    }
  }

  private publish(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const retailProductDataSource = new RetailProductDataSource();
