import type {
  BoletoStatus,
  Delivery,
  DeliveryBulkPatch,
  DeliveryDraft,
  DeliveryFilters,
  InvoiceStatus,
  PaymentMethod,
} from '@/types/data';
import { financialPeriodSnapshotCache } from '@/services/finance/FinancialPeriodSnapshotCache';
import { todayIso } from '@/utils/data';

import { deliveryQueryService } from './DeliveryQueryService';
import { createDeliveryFromDraft } from './deliveryRecord';
import { mockDeliveryDataSource } from './DeliveryDataSource';
import { firestoreDeliveryCacheService } from './FirestoreDeliveryCacheService';
import { firestoreHistoricalDeliveryCache } from './FirestoreHistoricalDeliveryCache';

type FirestoreDeliveryDocument = {
  clientId?: string;
  clientNameSnapshot: string;
  addressSnapshot?: string;
  date: string;
  quantity: number;
  unitPriceHistorical?: number;
  totalValue: number;
  status: string;
  delivered: boolean;
  invoiceStatus?: InvoiceStatus;
  boletoStatus?: BoletoStatus;
  paymentMethod?: PaymentMethod;
  observation?: string;
  legacyFields?: Record<string, unknown>;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type Listener = () => void;
type FirestoreOps = typeof import('firebase/firestore');
type HistoricalFetchResult = {
  deliveries: Delivery[];
  fromCache: boolean;
};

export type HistoricalDataState = 'unknown' | 'partial' | 'cache' | 'remote';

type SessionRequest = {
  uid: string;
  generation: number;
  sessionVersion?: number;
};

type DeliveryLoadOptions = {
  force?: boolean;
};

type HistoricalLoadOptions = {
  revalidate?: boolean;
};

type LoadState = {
  latestVersion: number;
  pendingVersions: Set<number>;
};

let firestoreOpsOverride: FirestoreOps | undefined;
let firestoreDbOverride: unknown | undefined;

export function setFirestoreDeliveryDataSourceOpsForTesting(
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
  const { collection } = await getFirestoreOps();
  if (firestoreDbOverride) {
    return collection(firestoreDbOverride as never, 'users', uid, 'deliveries');
  }
  const { getFirebaseFirestore } = await import('@/services/firebase/firestore');
  return collection(getFirebaseFirestore(), 'users', uid, 'deliveries');
}

function mapDocument(id: string, value: FirestoreDeliveryDocument): Delivery {
  const createdAt = normalizeCreatedAt(value.createdAt);

  return {
    id,
    ...(createdAt === undefined ? {} : { createdAt }),
    ...(value.clientId ? { clientId: `client:${value.clientId}` } : {}),
    cliente: value.clientNameSnapshot,
    quantidade: value.quantity,
    valor: value.totalValue,
    precoUnitarioHistorico: value.unitPriceHistorical,
    status: value.status,
    entregue: value.delivered,
    data: value.date,
    invoiceStatus: value.invoiceStatus,
    boletoStatus: value.boletoStatus,
    endereco: value.addressSnapshot,
    metodoPagamento: value.paymentMethod,
    observacao: value.observation,
    legacyFields: value.legacyFields,
  };
}

function normalizeCreatedAt(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (value instanceof Date) return value.getTime();
  if (!value || typeof value !== 'object') return undefined;

  const timestamp = value as {
    nanoseconds?: unknown;
    seconds?: unknown;
    toMillis?: unknown;
  };
  if (typeof timestamp.toMillis === 'function') {
    const milliseconds = timestamp.toMillis();
    return Number.isFinite(milliseconds) ? milliseconds : undefined;
  }
  if (typeof timestamp.seconds === 'number') {
    const nanoseconds = typeof timestamp.nanoseconds === 'number' ? timestamp.nanoseconds : 0;
    return timestamp.seconds * 1000 + nanoseconds / 1_000_000;
  }
  return undefined;
}

function toDocument(delivery: Delivery): FirestoreDeliveryDocument {
  if (!delivery.clientId?.startsWith('client:')) {
    throw new Error('Selecione um cliente Firestore válido.');
  }
  return {
    clientId: delivery.clientId.slice('client:'.length),
    clientNameSnapshot: delivery.cliente,
    ...(delivery.endereco ? { addressSnapshot: delivery.endereco } : {}),
    date: delivery.data,
    quantity: delivery.quantidade,
    totalValue: delivery.valor,
    status: delivery.status,
    delivered: delivery.entregue,
    ...(delivery.precoUnitarioHistorico === undefined
      ? {}
      : { unitPriceHistorical: delivery.precoUnitarioHistorico }),
    ...(delivery.invoiceStatus ? { invoiceStatus: delivery.invoiceStatus } : {}),
    ...(delivery.boletoStatus ? { boletoStatus: delivery.boletoStatus } : {}),
    ...(delivery.metodoPagamento ? { paymentMethod: delivery.metodoPagamento } : {}),
    ...(delivery.observacao ? { observation: delivery.observacao } : {}),
    ...(delivery.legacyFields ? { legacyFields: delivery.legacyFields } : {}),
  };
}

export class FirestoreDeliveryDataSource {
  public isUsingLocalFallback = false;
  private readonly records = new Map<string, Delivery>();
  private readonly listeners = new Set<Listener>();
  private activeUid?: string;
  private sessionUid: string | null | undefined;
  private sessionGeneration = 0;
  private boundSessionVersion: number | undefined;
  private mutationEpoch = 0;
  private revision = 0;
  private stateVersion = 0;
  private historicalApplyVersion = 0;
  private hasCompleteHistoricalState = false;
  private lastAppliedSource: 'cache' | 'remote' | null = null;
  private historicalDataState: HistoricalDataState = 'unknown';
  private readonly inFlightHydrations = new Map<string, Promise<boolean>>();
  private readonly inFlightLoads = new Map<string, Promise<Delivery[]>>();
  private readonly loadStates = new Map<string, LoadState>();
  private readonly inFlightHistoricalLoads = new Map<string, Promise<Delivery[]>>();
  private readonly dateCacheWrites = new Map<string, Promise<void>>();

  public getRevision = (): number => this.revision;

  public subscribe = (listener: Listener): (() => void) => {
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
    if (
      sessionVersion === undefined &&
      this.sessionUid === undefined &&
      userId &&
      this.activeUid === userId
    ) {
      this.sessionUid = nextSessionUid;
      this.boundSessionVersion = sessionVersion;
      return;
    }

    this.sessionUid = nextSessionUid;
    this.boundSessionVersion = sessionVersion;
    this.sessionGeneration += 1;
    this.mutationEpoch += 1;
    this.activeUid = userId;
    this.records.clear();
    this.isUsingLocalFallback = false;
    this.stateVersion += 1;
    this.historicalApplyVersion = 0;
    this.hasCompleteHistoricalState = false;
    this.lastAppliedSource = null;
    this.historicalDataState = 'unknown';
    firestoreHistoricalDeliveryCache.clearMemory();
    this.publish();
  }

  private beginSessionRequest(uid: string, sessionVersion?: number): number | null {
    if (sessionVersion !== undefined && this.boundSessionVersion !== sessionVersion) return null;
    if (this.sessionUid !== undefined && this.sessionUid !== uid) return null;
    if (this.activeUid && this.activeUid !== uid) {
      this.sessionGeneration += 1;
      this.mutationEpoch += 1;
      this.records.clear();
      this.stateVersion += 1;
      this.historicalApplyVersion = 0;
      this.hasCompleteHistoricalState = false;
      this.lastAppliedSource = null;
      this.historicalDataState = 'unknown';
      firestoreHistoricalDeliveryCache.clearMemory();
    }
    this.activeUid = uid;
    return this.sessionGeneration;
  }

  private isSessionRequestCurrent(
    uid: string,
    generation: number,
    sessionVersion?: number,
  ): boolean {
    return (
      (this.sessionUid === undefined || this.sessionUid === uid) &&
      this.sessionGeneration === generation &&
      this.activeUid === uid &&
      (sessionVersion === undefined || this.boundSessionVersion === sessionVersion)
    );
  }

  private captureSessionRequest(uid: string): SessionRequest {
    const generation = this.beginSessionRequest(uid);
    if (generation === null) throw new Error('Sessão alterada durante a operação.');
    this.mutationEpoch += 1;
    return { uid, generation, sessionVersion: this.boundSessionVersion };
  }

  private assertSessionRequestCurrent(request: SessionRequest): void {
    if (!this.isSessionRequestCurrent(request.uid, request.generation, request.sessionVersion)) {
      throw new Error('Sessão alterada durante a operação.');
    }
  }

  public getCached(filters: DeliveryFilters, uid?: string, sessionVersion?: number): Delivery[] {
    if (
      (this.sessionUid !== undefined && this.sessionUid !== (uid ?? null)) ||
      (this.sessionUid === undefined && this.activeUid !== undefined && this.activeUid !== uid) ||
      (sessionVersion !== undefined && this.boundSessionVersion !== sessionVersion)
    ) {
      return [];
    }
    const bounded = [...this.records.values()].filter((delivery) => {
      if (filters.date && delivery.data !== filters.date) return false;
      if (filters.startDate && delivery.data < filters.startDate) return false;
      if (filters.endDate && delivery.data > filters.endDate) return false;
      if (filters.clientId && delivery.clientId !== filters.clientId) return false;
      if (
        filters.clientIds &&
        (!delivery.clientId || !filters.clientIds.includes(delivery.clientId))
      ) {
        return false;
      }
      if (filters.status && filters.status !== 'Todos' && delivery.status !== filters.status) {
        return false;
      }
      return true;
    });
    return deliveryQueryService.filter(bounded, filters);
  }

  public hydrateFromCache(uid: string, date = todayIso()): Promise<boolean> {
    const sessionGeneration = this.beginSessionRequest(uid);
    if (sessionGeneration === null) return Promise.resolve(false);
    const key = this.requestKey(uid, sessionGeneration);
    const existing = this.inFlightHydrations.get(key);
    if (existing) return existing;

    const mutationEpoch = this.mutationEpoch;
    const hydration = this.hydrateFromCacheInternal(uid, date, sessionGeneration, mutationEpoch);
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
    uid: string,
    date: string,
    sessionGeneration: number,
    mutationEpoch: number,
  ): Promise<boolean> {
    const stateVersion = this.stateVersion;
    const startedWithRemoteState = this.lastAppliedSource === 'remote';
    if (startedWithRemoteState) return false;
    const [historicalCached, cached] = await Promise.all([
      firestoreHistoricalDeliveryCache.readEntry(uid),
      firestoreDeliveryCacheService.readEntry(uid, date),
    ]);

    if (
      !this.isSessionRequestCurrent(uid, sessionGeneration) ||
      this.mutationEpoch !== mutationEpoch ||
      this.stateVersion !== stateVersion ||
      this.lastAppliedSource === 'remote'
    ) {
      return false;
    }

    historicalCached?.deliveries.forEach((delivery) => this.records.set(delivery.id, delivery));
    const shouldApplyDailyCache =
      cached !== null && (historicalCached === null || cached.savedAt >= historicalCached.savedAt);
    if (shouldApplyDailyCache) {
      cached.deliveries.forEach((delivery) => this.records.set(delivery.id, delivery));
    }
    if (historicalCached !== null) {
      this.historicalDataState = 'cache';
      this.hasCompleteHistoricalState = true;
      this.historicalApplyVersion += 1;
    } else if (this.historicalDataState === 'unknown' && cached !== null) {
      this.historicalDataState = 'partial';
    }
    this.lastAppliedSource = 'cache';
    this.stateVersion += 1;
    this.publish();
    return cached !== null;
  }

  public async load(
    uid: string,
    filters: DeliveryFilters,
    options: DeliveryLoadOptions = {},
    sessionVersion?: number,
  ): Promise<Delivery[]> {
    if (filters.clientIds && filters.clientIds.length === 0) {
      return [];
    }
    if (!this.hasBoundedQuery(filters)) {
      return [];
    }
    const sessionGeneration = this.beginSessionRequest(uid, sessionVersion);
    if (sessionGeneration === null) return [];
    const key = `${this.requestKey(uid, sessionGeneration)}:${JSON.stringify(filters)}`;
    const existing = this.inFlightLoads.get(key);
    if (existing && !options.force) return existing;

    const mutationEpoch = this.mutationEpoch;
    const historicalApplyVersion = this.historicalApplyVersion;
    const loadState = this.loadStates.get(key) ?? {
      latestVersion: 0,
      pendingVersions: new Set<number>(),
    };
    const loadVersion = loadState.latestVersion + 1;
    loadState.latestVersion = loadVersion;
    loadState.pendingVersions.add(loadVersion);
    this.loadStates.set(key, loadState);
    const load = this.loadFromFirestore(
      uid,
      filters,
      sessionGeneration,
      sessionVersion,
      mutationEpoch,
      historicalApplyVersion,
      key,
      loadVersion,
    );
    this.inFlightLoads.set(key, load);
    void load.then(
      () => {
        if (this.inFlightLoads.get(key) === load) this.inFlightLoads.delete(key);
        this.releaseLoadVersion(key, loadState, loadVersion);
      },
      () => {
        if (this.inFlightLoads.get(key) === load) this.inFlightLoads.delete(key);
        this.releaseLoadVersion(key, loadState, loadVersion);
      },
    );
    return load;
  }

  private async loadFromFirestore(
    uid: string,
    filters: DeliveryFilters,
    sessionGeneration: number,
    sessionVersion: number | undefined,
    mutationEpoch: number,
    historicalApplyVersion: number,
    loadKey: string,
    loadVersion: number,
  ): Promise<Delivery[]> {
    const hydration = this.inFlightHydrations.get(this.requestKey(uid, sessionGeneration));
    if (hydration) await hydration;
    if (
      !this.isSessionRequestCurrent(uid, sessionGeneration, sessionVersion) ||
      this.mutationEpoch !== mutationEpoch ||
      !this.isLatestLoad(loadKey, loadVersion)
    ) {
      return this.isSessionRequestCurrent(uid, sessionGeneration, sessionVersion)
        ? this.getCached(filters, uid)
        : [];
    }
    try {
      const { doc, getDoc, getDocs, query, where } = await getFirestoreOps();
      const deliveryCollection = await collectionFor(uid);
      const constraints: Parameters<typeof query>[1][] = [];
      const loaded: Delivery[] = [];
      let fromCache = false;
      if (filters.deliveryId) {
        const result = await getDoc(doc(deliveryCollection, filters.deliveryId));
        fromCache ||= result.metadata?.fromCache === true;
        const mapped = result.exists()
          ? mapDocument(result.id, result.data() as FirestoreDeliveryDocument)
          : null;
        if (mapped) loaded.push(mapped);
      } else if (filters.deliveryIds?.length) {
        const results = await Promise.all(
          filters.deliveryIds.map((id) => getDoc(doc(deliveryCollection, id))),
        );
        results.forEach((result) => {
          fromCache ||= result.metadata?.fromCache === true;
          if (result.exists()) {
            const mapped = mapDocument(result.id, result.data() as FirestoreDeliveryDocument);
            loaded.push(mapped);
          }
        });
      } else {
        if (filters.date) constraints.push(where('date', '==', filters.date));
        if (filters.startDate) constraints.push(where('date', '>=', filters.startDate));
        if (filters.endDate) constraints.push(where('date', '<=', filters.endDate));
        if (filters.clientId?.startsWith('client:')) {
          constraints.push(where('clientId', '==', filters.clientId.slice('client:'.length)));
        }
        if (filters.status && filters.status !== 'Todos') {
          constraints.push(where('status', '==', filters.status));
        }
        const clientDocumentIds = filters.clientIds
          ?.filter((clientId) => clientId.startsWith('client:'))
          .map((clientId) => clientId.slice('client:'.length));
        const clientIdChunks = filters.clientIds
          ? clientDocumentIds?.length
            ? chunk(clientDocumentIds, 30)
            : []
          : [undefined];
        const results = await Promise.all(
          clientIdChunks.map((clientIds) =>
            getDocs(
              query(
                deliveryCollection,
                ...constraints,
                ...(clientIds ? [where('clientId', 'in', clientIds)] : []),
              ),
            ),
          ),
        );
        results.forEach((result) => {
          fromCache ||= result.metadata?.fromCache === true;
          result.docs.forEach((item) => {
            loaded.push(mapDocument(item.id, item.data() as FirestoreDeliveryDocument));
          });
        });
      }
      if (
        !this.isSessionRequestCurrent(uid, sessionGeneration, sessionVersion) ||
        this.mutationEpoch !== mutationEpoch ||
        !this.isLatestLoad(loadKey, loadVersion)
      ) {
        return this.isSessionRequestCurrent(uid, sessionGeneration, sessionVersion)
          ? this.getCached(filters, uid)
          : [];
      }
      const hadRemoteState = this.lastAppliedSource === 'remote';
      const protectCompleteHistory =
        this.hasCompleteHistoricalState && this.historicalApplyVersion !== historicalApplyVersion;
      this.applyLoadedRecords(filters, loaded, fromCache, protectCompleteHistory);
      this.isUsingLocalFallback = false;
      this.lastAppliedSource = hadRemoteState || !fromCache ? 'remote' : 'cache';
      if (this.historicalDataState === 'unknown') this.historicalDataState = 'partial';
      this.stateVersion += 1;
      this.publish();
      const result = this.getCached(filters, uid);
      if (filters.date && !fromCache) {
        void this.persistDateCache({ uid, generation: sessionGeneration }, filters.date);
      }
      return result;
    } catch (error) {
      if (
        !this.isSessionRequestCurrent(uid, sessionGeneration, sessionVersion) ||
        this.mutationEpoch !== mutationEpoch
      ) {
        return [];
      }
      if (!this.isLatestLoad(loadKey, loadVersion)) return this.getCached(filters, uid);
      this.isUsingLocalFallback = false;
      throw error;
    }
  }

  public async loadAllHistorical(
    uid: string,
    sessionVersion?: number,
    options: HistoricalLoadOptions = {},
  ): Promise<Delivery[]> {
    const sessionGeneration = this.beginSessionRequest(uid, sessionVersion);
    if (sessionGeneration === null) return [];
    const key = `${this.requestKey(uid, sessionGeneration)}:${options.revalidate ? 'revalidate' : 'cache'}`;
    const existing = this.inFlightHistoricalLoads.get(key);
    if (existing) return existing;

    const load = this.loadAllHistoricalInternal(uid, sessionGeneration, sessionVersion, options);
    this.inFlightHistoricalLoads.set(key, load);
    void load.then(
      () => {
        if (this.inFlightHistoricalLoads.get(key) === load) {
          this.inFlightHistoricalLoads.delete(key);
        }
      },
      () => {
        if (this.inFlightHistoricalLoads.get(key) === load) {
          this.inFlightHistoricalLoads.delete(key);
        }
      },
    );
    return load;
  }

  private async loadAllHistoricalInternal(
    uid: string,
    sessionGeneration: number,
    sessionVersion: number | undefined,
    options: HistoricalLoadOptions,
  ): Promise<Delivery[]> {
    const hydration = this.inFlightHydrations.get(this.requestKey(uid, sessionGeneration));
    if (hydration) await hydration;
    const mutationEpoch = this.mutationEpoch;
    const cached = await firestoreHistoricalDeliveryCache.read(uid);
    if (
      !this.isSessionRequestCurrent(uid, sessionGeneration, sessionVersion) ||
      this.mutationEpoch !== mutationEpoch
    ) {
      return [];
    }
    if (cached !== null) {
      let changed = false;
      cached.forEach((delivery) => {
        if (!this.records.has(delivery.id)) {
          this.records.set(delivery.id, delivery);
          changed = true;
        }
      });
      this.historicalDataState = 'cache';
      this.hasCompleteHistoricalState = true;
      this.historicalApplyVersion += 1;
      if (changed) {
        this.stateVersion += 1;
        this.publish();
      }
      if (!options.revalidate) return this.getCached({ mode: 'all' }, uid);
    }

    try {
      const { deliveries: loaded, fromCache } = await this.fetchAllHistoricalFromFirestore(uid);
      if (
        !this.isSessionRequestCurrent(uid, sessionGeneration, sessionVersion) ||
        this.mutationEpoch !== mutationEpoch
      ) {
        return [];
      }
      const hadRemoteState = this.lastAppliedSource === 'remote';
      this.isUsingLocalFallback = false;
      if (fromCache) {
        loaded.forEach((delivery) => {
          if (!this.records.has(delivery.id)) this.records.set(delivery.id, delivery);
        });
        this.historicalDataState = 'partial';
      } else {
        this.records.clear();
        loaded.forEach((delivery) => this.records.set(delivery.id, delivery));
        this.historicalDataState = 'remote';
        this.hasCompleteHistoricalState = true;
        this.historicalApplyVersion += 1;
      }
      this.lastAppliedSource = hadRemoteState || !fromCache ? 'remote' : 'cache';
      this.stateVersion += 1;
      this.publish();
      if (
        !fromCache &&
        this.isSessionRequestCurrent(uid, sessionGeneration, sessionVersion) &&
        this.mutationEpoch === mutationEpoch
      ) {
        await firestoreHistoricalDeliveryCache.write(uid, loaded);
      }
      return fromCache ? this.getCached({ mode: 'all' }, uid) : loaded;
    } catch (error) {
      if (
        !this.isSessionRequestCurrent(uid, sessionGeneration, sessionVersion) ||
        this.mutationEpoch !== mutationEpoch
      ) {
        return [];
      }
      this.isUsingLocalFallback = false;
      throw error;
    }
  }

  private async fetchAllHistoricalFromFirestore(uid: string): Promise<HistoricalFetchResult> {
    const { getDocs, limit, orderBy, query, startAfter } = await getFirestoreOps();
    const deliveryCollection = await collectionFor(uid);
    const BATCH_SIZE = 250;
    const loaded: Delivery[] = [];
    let fromCache = false;
    let lastVisibleDoc: unknown = null;
    let hasMore = true;

    while (hasMore) {
      const constraints: Parameters<typeof query>[1][] = [
        orderBy('date', 'desc'),
        limit(BATCH_SIZE),
      ];
      if (lastVisibleDoc) {
        constraints.push(startAfter(lastVisibleDoc));
      }

      const snapshot = await getDocs(query(deliveryCollection, ...constraints));
      fromCache ||= snapshot.metadata?.fromCache === true;
      if (snapshot.empty) break;

      snapshot.docs.forEach((docSnapshot) => {
        const delivery = mapDocument(
          docSnapshot.id,
          docSnapshot.data() as FirestoreDeliveryDocument,
        );
        loaded.push(delivery);
      });

      if (snapshot.docs.length < BATCH_SIZE) {
        hasMore = false;
      } else {
        lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
      }
    }

    return { deliveries: loaded, fromCache };
  }

  private applyLoadedRecords(
    filters: DeliveryFilters,
    loaded: readonly Delivery[],
    fromCache: boolean,
    protectCompleteHistory = false,
  ): void {
    if (!protectCompleteHistory && !fromCache && this.isCompleteDateQuery(filters)) {
      this.replaceDateRecords(filters);
    }
    loaded.forEach((delivery) => {
      if ((protectCompleteHistory || fromCache) && this.records.has(delivery.id)) return;
      if (!fromCache || !this.records.has(delivery.id)) {
        this.records.set(delivery.id, delivery);
      }
    });
  }

  private isCompleteDateQuery(filters: DeliveryFilters): boolean {
    return Boolean(
      filters.date &&
      !filters.deliveryId &&
      !filters.deliveryIds?.length &&
      !filters.clientId &&
      !filters.clientIds?.length &&
      (!filters.status || filters.status === 'Todos'),
    );
  }

  public async create(uid: string, draft: DeliveryDraft): Promise<Delivery> {
    const request = this.captureSessionRequest(uid);
    if (this.isUsingLocalFallback)
      return mockDeliveryDataSource.createFromRegistration({
        clientName: draft.clientName,
        date: new Date(`${draft.date}T12:00:00`),
        quantity: draft.quantity,
        bucketPrice: draft.historicalUnitPrice ?? draft.value / draft.quantity,
      });
    const delivery = createDeliveryFromDraft(draft);
    const { doc, serverTimestamp, setDoc } = await getFirestoreOps();
    const reference = doc(await collectionFor(request.uid));
    await setDoc(reference, { ...toDocument(delivery), createdAt: serverTimestamp() });
    this.assertSessionRequestCurrent(request);
    const created = { ...delivery, id: reference.id };
    this.records.set(created.id, created);
    this.publish();
    void this.persistDateCache(request, created.data);
    void financialPeriodSnapshotCache.invalidate(request.uid, created.data.slice(0, 7));
    void firestoreHistoricalDeliveryCache.invalidate(request.uid);
    return created;
  }

  public async update(uid: string, deliveryId: string, draft: DeliveryDraft): Promise<Delivery> {
    const request = this.captureSessionRequest(uid);
    const previous = this.records.get(deliveryId);
    if (!previous) {
      await this.load(uid, { mode: 'all', deliveryId });
    }
    this.assertSessionRequestCurrent(request);
    const current = this.records.get(deliveryId);
    if (!current) throw new Error('Entrega não encontrada.');
    const delivery = createDeliveryFromDraft(
      { ...draft, id: deliveryId, clientId: draft.clientId ?? current.clientId },
      current,
    );
    const { doc, setDoc, serverTimestamp } = await getFirestoreOps();
    await setDoc(
      doc(await collectionFor(request.uid), deliveryId),
      {
        ...toDocument(delivery),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    this.assertSessionRequestCurrent(request);
    this.records.set(deliveryId, delivery);
    this.publish();
    void this.persistDateCache(request, current.data);
    if (current.data !== delivery.data) void this.persistDateCache(request, delivery.data);
    void financialPeriodSnapshotCache.invalidate(request.uid, delivery.data.slice(0, 7));
    if (current.data.slice(0, 7) !== delivery.data.slice(0, 7)) {
      void financialPeriodSnapshotCache.invalidate(request.uid, current.data.slice(0, 7));
    }
    void firestoreHistoricalDeliveryCache.invalidate(request.uid);
    return delivery;
  }

  public async remove(uid: string, deliveryId: string): Promise<void> {
    const request = this.captureSessionRequest(uid);
    const previous = this.records.get(deliveryId);
    const { deleteDoc, doc } = await getFirestoreOps();
    await deleteDoc(doc(await collectionFor(request.uid), deliveryId));
    this.assertSessionRequestCurrent(request);
    this.records.delete(deliveryId);
    this.publish();
    if (previous) void this.persistDateCache(request, previous.data);
    if (previous)
      void financialPeriodSnapshotCache.invalidate(request.uid, previous.data.slice(0, 7));
    void firestoreHistoricalDeliveryCache.invalidate(request.uid);
  }

  public async toggleDelivered(uid: string, deliveryId: string): Promise<void> {
    const request = this.captureSessionRequest(uid);
    const current = await this.ensure(uid, deliveryId);
    this.assertSessionRequestCurrent(request);
    const { doc, serverTimestamp, updateDoc } = await getFirestoreOps();
    await updateDoc(doc(await collectionFor(request.uid), deliveryId), {
      delivered: !current.entregue,
      updatedAt: serverTimestamp(),
    });
    this.assertSessionRequestCurrent(request);
    this.records.set(deliveryId, { ...current, entregue: !current.entregue });
    this.publish();
    void this.persistDateCache(request, current.data);
    void financialPeriodSnapshotCache.invalidate(request.uid, current.data.slice(0, 7));
    void firestoreHistoricalDeliveryCache.invalidate(request.uid);
  }

  public async updateInvoiceStatus(
    uid: string,
    deliveryId: string,
    status: InvoiceStatus,
  ): Promise<void> {
    const request = this.captureSessionRequest(uid);
    const current = await this.ensure(uid, deliveryId);
    this.assertSessionRequestCurrent(request);
    const { doc, serverTimestamp, updateDoc } = await getFirestoreOps();
    await updateDoc(doc(await collectionFor(request.uid), deliveryId), {
      invoiceStatus: status,
      updatedAt: serverTimestamp(),
    });
    this.assertSessionRequestCurrent(request);
    this.records.set(deliveryId, { ...current, invoiceStatus: status });
    this.publish();
    void this.persistDateCache(request, current.data);
    void financialPeriodSnapshotCache.invalidate(request.uid, current.data.slice(0, 7));
    void firestoreHistoricalDeliveryCache.invalidate(request.uid);
  }

  public async updateBoletoStatus(
    uid: string,
    deliveryId: string,
    status: BoletoStatus,
  ): Promise<void> {
    const request = this.captureSessionRequest(uid);
    const current = await this.ensure(uid, deliveryId);
    this.assertSessionRequestCurrent(request);
    const { doc, serverTimestamp, updateDoc } = await getFirestoreOps();
    await updateDoc(doc(await collectionFor(request.uid), deliveryId), {
      boletoStatus: status,
      updatedAt: serverTimestamp(),
    });
    this.assertSessionRequestCurrent(request);
    this.records.set(deliveryId, { ...current, boletoStatus: status });
    this.publish();
    void this.persistDateCache(request, current.data);
    void financialPeriodSnapshotCache.invalidate(request.uid, current.data.slice(0, 7));
    void firestoreHistoricalDeliveryCache.invalidate(request.uid);
  }

  public async settle(
    uid: string,
    deliveryIds: readonly string[],
    method: PaymentMethod,
  ): Promise<void> {
    if (!deliveryIds.length) throw new Error('Selecione ao menos uma entrega para quitar.');
    if (!['Dinheiro', 'Pix'].includes(method))
      throw new Error('Escolha Dinheiro ou Pix para quitar as entregas.');
    const request = this.captureSessionRequest(uid);
    const { doc, serverTimestamp, updateDoc } = await getFirestoreOps();
    const deliveryCollection = await collectionFor(request.uid);
    await Promise.all(
      deliveryIds.map(async (id) => {
        const current = await this.ensure(uid, id);
        this.assertSessionRequestCurrent(request);
        if (current.status === 'Pago' || !current.entregue)
          throw new Error('Somente entregas não pagas e entregues podem ser quitadas.');
        await updateDoc(doc(deliveryCollection, id), {
          status: 'Pago',
          paymentMethod: method,
          updatedAt: serverTimestamp(),
        });
        this.assertSessionRequestCurrent(request);
        this.records.set(id, { ...current, status: 'Pago', metodoPagamento: method });
        void financialPeriodSnapshotCache.invalidate(request.uid, current.data.slice(0, 7));
      }),
    );
    this.assertSessionRequestCurrent(request);
    this.publish();
    [...new Set(deliveryIds.map((id) => this.records.get(id)?.data))]
      .filter((date): date is string => Boolean(date))
      .forEach((date) => void this.persistDateCache(request, date));
    void firestoreHistoricalDeliveryCache.invalidate(request.uid);
  }

  public async editMany(
    uid: string,
    ids: readonly string[],
    patch: DeliveryBulkPatch,
  ): Promise<void> {
    const request = this.captureSessionRequest(uid);
    const { doc, serverTimestamp, updateDoc } = await getFirestoreOps();
    const deliveryCollection = await collectionFor(request.uid);
    await Promise.all(
      ids.map(async (id) => {
        const current = await this.ensure(uid, id);
        this.assertSessionRequestCurrent(request);
        await updateDoc(doc(deliveryCollection, id), {
          ...(patch.status ? { status: patch.status } : {}),
          ...(patch.entregue === undefined ? {} : { delivered: patch.entregue }),
          ...(patch.invoiceStatus ? { invoiceStatus: patch.invoiceStatus } : {}),
          ...(patch.boletoStatus ? { boletoStatus: patch.boletoStatus } : {}),
          updatedAt: serverTimestamp(),
        });
        this.assertSessionRequestCurrent(request);
        this.records.set(id, { ...current, ...patch });
        void financialPeriodSnapshotCache.invalidate(request.uid, current.data.slice(0, 7));
      }),
    );
    this.assertSessionRequestCurrent(request);
    this.publish();
    [...new Set(ids.map((id) => this.records.get(id)?.data))]
      .filter((date): date is string => Boolean(date))
      .forEach((date) => void this.persistDateCache(request, date));
    void firestoreHistoricalDeliveryCache.invalidate(request.uid);
  }

  private async ensure(uid: string, id: string): Promise<Delivery> {
    const cached = this.records.get(id);
    if (cached) return cached;
    await this.load(uid, { mode: 'all', deliveryId: id });
    const loaded = this.records.get(id);
    if (!loaded) throw new Error('Entrega não encontrada.');
    return loaded;
  }

  private hasBoundedQuery(filters: DeliveryFilters): boolean {
    return Boolean(
      filters.date ||
      filters.startDate ||
      filters.endDate ||
      filters.deliveryId ||
      filters.deliveryIds?.length ||
      filters.clientId ||
      filters.clientIds?.length ||
      (filters.status && filters.status !== 'Todos'),
    );
  }

  private replaceDateRecords(filters: DeliveryFilters): void {
    if (!filters.date) return;
    for (const [id, delivery] of this.records) {
      if (delivery.data === filters.date) {
        this.records.delete(id);
      }
    }
  }

  private persistDateCache(request: SessionRequest, date?: string): Promise<void> {
    if (!date || !this.isSessionRequestCurrent(request.uid, request.generation)) {
      return Promise.resolve();
    }
    const key = `${request.uid}:${date}`;
    const previous = this.dateCacheWrites.get(key) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        if (!this.isSessionRequestCurrent(request.uid, request.generation)) return;
        const sameDate = [...this.records.values()].filter((item) => item.data === date);
        await firestoreDeliveryCacheService.write(request.uid, date, sameDate);
      });
    this.dateCacheWrites.set(key, next);
    void next.then(
      () => {
        if (this.dateCacheWrites.get(key) === next) this.dateCacheWrites.delete(key);
      },
      () => {
        if (this.dateCacheWrites.get(key) === next) this.dateCacheWrites.delete(key);
      },
    );
    return next;
  }

  private requestKey(uid: string, generation: number): string {
    return `${uid}:${generation}`;
  }

  public getHistoricalDataState = (): HistoricalDataState => this.historicalDataState;

  private isLatestLoad(key: string, version: number): boolean {
    return this.loadStates.get(key)?.latestVersion === version;
  }

  private releaseLoadVersion(key: string, state: LoadState, version: number): void {
    state.pendingVersions.delete(version);
    if (state.pendingVersions.size === 0 && this.loadStates.get(key) === state) {
      this.loadStates.delete(key);
    }
  }

  private publish(): void {
    this.revision += 1;
    this.listeners.forEach((listener) => listener());
  }
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

export const firestoreDeliveryDataSource = new FirestoreDeliveryDataSource();
