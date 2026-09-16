import type {
  RetailCompositionComponent,
  RetailCompositionVersion,
  RetailCompositionVersionDraft,
  RetailCostItem,
} from '@/types/data';
import { assertFirestoreUid } from '@/services/database/firestorePaths';

import { retailCompositionCatalogCache } from './RetailCompositionCatalogCache';
import {
  isStrictRetailIsoDate,
  normalizeRetailDate,
  normalizeRetailQuantity,
  retailUnitsMatch,
} from './retailCostUtils';

type RetailCompositionVersionDocument = {
  compositionVersionId?: string;
  productId: string;
  effectiveFrom: string;
  active: boolean;
  components: RetailCompositionComponent[];
  createdAt?: unknown;
};

export type RetailCompositionVersionRecord = RetailCompositionVersionDocument & { id: string };
export type RetailCompositionCostItem = Pick<RetailCostItem, 'costItemId' | 'name' | 'unit'>;

type SessionRequest = {
  userId: string;
  generation: number;
  sessionVersion?: number;
};

type FirestoreOps = Pick<
  typeof import('firebase/firestore'),
  'collection' | 'doc' | 'getDocs' | 'serverTimestamp' | 'setDoc'
>;

let firestoreOpsOverride: FirestoreOps | undefined;
let firestoreDbOverride: unknown | undefined;

export function setFirestoreRetailCompositionDataSourceOpsForTesting(
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

async function collectionFor(uid: string, productId: string) {
  assertFirestoreUid(uid);
  assertId(productId, 'produto');
  const { collection } = await getFirestoreOps();
  if (firestoreDbOverride) {
    return collection(
      firestoreDbOverride as never,
      'users',
      uid,
      'retailProducts',
      productId,
      'compositionVersions',
    );
  }
  const { getFirebaseFirestore } = await import('@/services/firebase/firestore');
  return collection(
    getFirebaseFirestore(),
    'users',
    uid,
    'retailProducts',
    productId,
    'compositionVersions',
  );
}

function recordFromDocument(
  id: string,
  data: Record<string, unknown>,
): RetailCompositionVersionRecord {
  return { id, ...(data as RetailCompositionVersionDocument) };
}

function normalizeComponents(
  components: readonly RetailCompositionComponent[],
  costItems: ReadonlyMap<string, RetailCompositionCostItem>,
): RetailCompositionComponent[] {
  if (!components.length) throw new Error('Adicione ao menos um componente à composição.');
  const seen = new Set<string>();
  return components.map((component) => {
    const costItemId = component.costItemId.trim();
    if (!costItemId) throw new Error('Selecione um item de custo para cada componente.');
    if (seen.has(costItemId)) throw new Error('Um item de custo não pode aparecer duas vezes.');
    seen.add(costItemId);
    const item = costItems.get(costItemId);
    if (!item) throw new Error('Um componente selecionado não foi encontrado.');
    const quantity = normalizeRetailQuantity(component.quantity, 'A quantidade do componente');
    if (!retailUnitsMatch(component.unit, item.unit)) {
      throw new Error('A unidade do componente deve corresponder à unidade-base do item.');
    }
    return {
      costItemId,
      costItemNameSnapshot: item.name,
      quantity,
      unit: item.unit,
    };
  });
}

function documentToVersion(
  record: RetailCompositionVersionRecord,
): RetailCompositionVersion | undefined {
  if (
    !record.id ||
    typeof record.productId !== 'string' ||
    !record.productId ||
    typeof record.effectiveFrom !== 'string' ||
    !isStrictRetailIsoDate(record.effectiveFrom) ||
    typeof record.active !== 'boolean' ||
    !Array.isArray(record.components)
  ) {
    return undefined;
  }
  const components = record.components;
  if (
    !components.every(
      (component) =>
        typeof component?.costItemId === 'string' &&
        typeof component?.quantity === 'number' &&
        Number.isFinite(component.quantity) &&
        component.quantity > 0 &&
        typeof component?.unit === 'string' &&
        typeof component?.costItemNameSnapshot === 'string',
    )
  ) {
    return undefined;
  }
  return {
    active: record.active,
    components,
    compositionVersionId: record.id,
    createdAt: record.createdAt as RetailCompositionVersion['createdAt'],
    effectiveFrom: record.effectiveFrom,
    productId: record.productId,
  };
}

function snapshotForRecords(
  records: readonly RetailCompositionVersionRecord[],
): readonly RetailCompositionVersion[] {
  return records.flatMap((record) => {
    const version = documentToVersion(record);
    return version ? [version] : [];
  });
}

function sortVersions(versions: readonly RetailCompositionVersion[]): RetailCompositionVersion[] {
  return versions
    .slice()
    .sort(
      (left, right) =>
        right.effectiveFrom.localeCompare(left.effectiveFrom) ||
        right.compositionVersionId.localeCompare(left.compositionVersionId),
    );
}

export class RetailCompositionDataSource {
  private recordsByProductId = new Map<string, RetailCompositionVersionRecord[]>();
  private snapshotsByProductId = new Map<string, readonly RetailCompositionVersion[]>();
  private readonly listeners = new Set<() => void>();
  private activeUid?: string;
  private sessionUid: string | null | undefined;
  private sessionGeneration = 0;
  private boundSessionVersion: number | undefined;
  private loadEpoch = 0;
  private readonly inFlightHydrations = new Map<string, Promise<boolean>>();
  private readonly inFlightLoads = new Map<string, Promise<void>>();

  public getSnapshot = (
    productId: string | undefined,
    userId?: string,
    sessionVersion?: number,
  ): readonly RetailCompositionVersion[] | null => {
    if (!productId || !this.isSessionVisible(userId, sessionVersion)) return null;
    return this.snapshotsByProductId.get(productId) ?? null;
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
    this.recordsByProductId.clear();
    this.snapshotsByProductId.clear();
    this.publish();
  }

  public async hydrateFromCache(
    productId: string,
    userId: string,
    sessionVersion?: number,
  ): Promise<boolean> {
    assertId(productId, 'produto');
    const generation = this.beginSessionRequest(userId, sessionVersion);
    if (generation === null) return false;
    const key = this.productRequestKey(userId, generation, productId);
    const existing = this.inFlightHydrations.get(key);
    if (existing) return existing;
    const epoch = this.loadEpoch;
    const hydration = this.hydrateFromCacheInternal(
      productId,
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
    productId: string,
    userId: string,
    generation: number,
    sessionVersion: number | undefined,
    epoch: number,
  ): Promise<boolean> {
    const cachedRecords = await retailCompositionCatalogCache.read(userId, productId);
    if (
      !this.isSessionRequestCurrent(userId, generation, sessionVersion) ||
      this.loadEpoch !== epoch ||
      this.snapshotsByProductId.has(productId)
    ) {
      return false;
    }
    if (!cachedRecords) return false;
    this.recordsByProductId.set(productId, cachedRecords);
    this.snapshotsByProductId.set(productId, sortVersions(snapshotForRecords(cachedRecords)));
    this.publish();
    return true;
  }

  public async load(productId: string, userId?: string, sessionVersion?: number): Promise<void> {
    if (!userId) throw new Error('Sessão não disponível.');
    assertId(productId, 'produto');
    const generation = this.beginSessionRequest(userId, sessionVersion);
    if (generation === null) return;
    const epoch = this.loadEpoch;
    const key = `${this.productRequestKey(userId, generation, productId)}:${epoch}`;
    const existing = this.inFlightLoads.get(key);
    if (existing) return existing;
    const load = this.loadFromFirestore(productId, userId, generation, sessionVersion, epoch);
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
    productId: string,
    userId: string,
    generation: number,
    sessionVersion: number | undefined,
    epoch: number,
  ): Promise<void> {
    await this.hydrateFromCache(productId, userId, sessionVersion);
    if (
      !this.isSessionRequestCurrent(userId, generation, sessionVersion) ||
      this.loadEpoch !== epoch
    ) {
      return;
    }
    try {
      const { getDocs } = await getFirestoreOps();
      const result = await getDocs(await collectionFor(userId, productId));
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
                ...(this.recordsByProductId.get(productId) ?? []).map(
                  (record) => [record.id, record] as const,
                ),
                ...loadedRecords.map((record) => [record.id, record] as const),
              ]).values(),
            ]
          : loadedRecords;
      this.recordsByProductId.set(productId, currentRecords);
      this.snapshotsByProductId.set(productId, sortVersions(snapshotForRecords(currentRecords)));
      if (result.metadata?.fromCache !== true) {
        void retailCompositionCatalogCache
          .write(userId, productId, currentRecords)
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

  public list(
    productId: string,
    userId?: string,
    sessionVersion?: number,
  ): RetailCompositionVersion[] {
    if (!this.isSessionVisible(userId, sessionVersion)) return [];
    return sortVersions(this.snapshotsByProductId.get(productId) ?? []);
  }

  public async createVersion(
    userId: string | undefined,
    productId: string,
    input: RetailCompositionVersionDraft,
    costItems: ReadonlyMap<string, RetailCompositionCostItem>,
    sessionVersion?: number,
  ): Promise<string> {
    const request = this.captureSessionRequest(userId, sessionVersion);
    assertId(productId, 'produto');
    const effectiveFrom = normalizeRetailDate(input.effectiveFrom);
    const components = normalizeComponents(input.components, costItems);
    const { doc, serverTimestamp, setDoc } = await getFirestoreOps();
    this.assertSessionRequestCurrent(request);
    const reference = doc(await collectionFor(request.userId, productId));
    await setDoc(reference, {
      active: input.active ?? true,
      components,
      compositionVersionId: reference.id,
      createdAt: serverTimestamp(),
      effectiveFrom,
      productId,
    });
    this.assertSessionRequestCurrent(request);
    const currentRecords = this.recordsByProductId.get(productId) ?? [];
    const localRecord: RetailCompositionVersionRecord = {
      active: input.active ?? true,
      components,
      effectiveFrom,
      id: reference.id,
      productId,
    };
    const nextRecords = [
      ...currentRecords.filter((record) => record.id !== reference.id),
      localRecord,
    ];
    this.recordsByProductId.set(productId, nextRecords);
    this.snapshotsByProductId.set(productId, sortVersions(snapshotForRecords(nextRecords)));
    this.publish();
    void retailCompositionCatalogCache
      .write(request.userId, productId, nextRecords)
      .catch(() => undefined);
    return reference.id;
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

  private productRequestKey(userId: string, generation: number, productId: string): string {
    return `${userId}:${generation}:${productId}`;
  }

  private publish(): void {
    this.listeners.forEach((listener) => listener());
  }
}

function assertId(value: string, label: string): void {
  if (!value.trim() || value.includes('/')) throw new Error(`ID de ${label} inválido.`);
}

export const retailCompositionDataSource = new RetailCompositionDataSource();
