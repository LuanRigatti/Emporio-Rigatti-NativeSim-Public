import type {
  RetailCompositionVersionSnapshot,
  RetailCostBreakdownSnapshot,
  RetailOrder,
  RetailOrderCreateInput,
  RetailOrderLineItem,
  RetailOrderPatch,
  RetailOrderQuery,
  RetailOrderStatus,
} from '@/types/data';
import { assertFirestoreUid } from '@/services/database/firestorePaths';
import {
  isStrictRetailIsoDate,
  normalizeRetailDate,
  normalizeRetailMoney,
} from '@/services/retail-costs/retailCostUtils';

import { buildRetailOrderWriteData, type RetailOrderCatalogContext } from './RetailOrderBuilder';
import { retailOrderCatalogCache } from './RetailOrderCatalogCache';
import { retailPaymentDataSource, type RetailPaymentDataSource } from './RetailPaymentDataSource';
import {
  allocateDiscountCents,
  centsToMoney,
  moneyToCents,
  optionalRetailOrderText,
  roundRetailOrderMoney,
} from './retailOrderUtils';

type RetailOrderDocument = Omit<RetailOrder, 'createdAt' | 'updatedAt'> & {
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type RetailOrderRecord = RetailOrderDocument & { id: string };

type SessionRequest = {
  userId: string;
  generation: number;
  sessionVersion?: number;
};

type DocumentSnapshotLike = {
  exists: () => boolean;
  data: () => Record<string, unknown> | undefined;
};

type QuerySnapshotLike = {
  docs: { id: string; data: () => Record<string, unknown> }[];
  metadata?: { fromCache?: boolean };
};

type FirestoreOps = Pick<
  typeof import('firebase/firestore'),
  | 'collection'
  | 'deleteField'
  | 'doc'
  | 'getDoc'
  | 'getDocs'
  | 'serverTimestamp'
  | 'setDoc'
  | 'updateDoc'
> & {
  getDocsFromServer?: (typeof import('firebase/firestore'))['getDocsFromServer'];
};

let firestoreOpsOverride: FirestoreOps | undefined;
let firestoreDbOverride: unknown | undefined;

export function setFirestoreRetailOrderDataSourceOpsForTesting(
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
  const db =
    firestoreDbOverride ?? (await import('@/services/firebase/firestore')).getFirebaseFirestore();
  return collection(db as never, 'users', uid, 'retailOrders');
}

function recordFromDocument(id: string, data: Record<string, unknown>): RetailOrderRecord {
  return { id, ...(data as RetailOrderDocument) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function optionalDocumentText(value: unknown): string | undefined {
  return typeof value === 'string' ? optionalRetailOrderText(value) : undefined;
}

function isCostBreakdownSnapshot(value: unknown): value is RetailCostBreakdownSnapshot {
  return (
    isRecord(value) &&
    typeof value.costItemId === 'string' &&
    typeof value.costItemNameSnapshot === 'string' &&
    typeof value.quantity === 'number' &&
    Number.isFinite(value.quantity) &&
    value.quantity > 0 &&
    typeof value.unit === 'string' &&
    typeof value.effectiveDate === 'string' &&
    isStrictRetailIsoDate(value.effectiveDate) &&
    isFiniteNonNegative(value.unitCostSnapshot) &&
    isFiniteNonNegative(value.totalCostSnapshot)
  );
}

function compositionSnapshot(value: unknown): RetailCompositionVersionSnapshot | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.compositionVersionId !== 'string' ||
    typeof value.effectiveFrom !== 'string' ||
    !isStrictRetailIsoDate(value.effectiveFrom) ||
    !Array.isArray(value.components) ||
    !value.components.every(isCostBreakdownSnapshot)
  ) {
    return undefined;
  }
  return {
    compositionVersionId: value.compositionVersionId,
    components: value.components,
    effectiveFrom: value.effectiveFrom,
  };
}

function lineItemFromDocument(value: unknown): RetailOrderLineItem | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.productId !== 'string' ||
    !value.productId ||
    typeof value.productNameSnapshot !== 'string' ||
    !value.productNameSnapshot ||
    typeof value.categoryIdSnapshot !== 'string' ||
    !value.categoryIdSnapshot ||
    typeof value.categorySnapshot !== 'string' ||
    !value.categorySnapshot ||
    !isFiniteNonNegative(value.quantity) ||
    value.quantity <= 0 ||
    !isFiniteNonNegative(value.unitSalePriceSnapshot) ||
    !isFiniteNonNegative(value.lineSubtotal) ||
    !isFiniteNonNegative(value.discountAllocatedSnapshot) ||
    !isFiniteNonNegative(value.unitCostSnapshot) ||
    !isFiniteNonNegative(value.lineCostTotal) ||
    !Array.isArray(value.costBreakdownSnapshot) ||
    !value.costBreakdownSnapshot.every(isCostBreakdownSnapshot)
  ) {
    return undefined;
  }
  const optionalFields = {
    ...(optionalDocumentText(value.variantSnapshot)
      ? { variantSnapshot: optionalDocumentText(value.variantSnapshot) }
      : {}),
    ...(optionalDocumentText(value.flavorSnapshot)
      ? { flavorSnapshot: optionalDocumentText(value.flavorSnapshot) }
      : {}),
    ...(optionalDocumentText(value.packageSizeSnapshot)
      ? { packageSizeSnapshot: optionalDocumentText(value.packageSizeSnapshot) }
      : {}),
  };
  const compositionVersionSnapshot = compositionSnapshot(value.compositionVersionSnapshot);
  if (value.compositionVersionSnapshot !== undefined && !compositionVersionSnapshot) {
    return undefined;
  }
  return {
    categoryIdSnapshot: value.categoryIdSnapshot,
    categorySnapshot: value.categorySnapshot,
    ...optionalFields,
    lineCostTotal: value.lineCostTotal,
    lineSubtotal: value.lineSubtotal,
    costBreakdownSnapshot: value.costBreakdownSnapshot,
    ...(compositionVersionSnapshot ? { compositionVersionSnapshot } : {}),
    discountAllocatedSnapshot: value.discountAllocatedSnapshot,
    productId: value.productId,
    productNameSnapshot: value.productNameSnapshot,
    quantity: value.quantity,
    unitCostSnapshot: value.unitCostSnapshot,
    unitSalePriceSnapshot: value.unitSalePriceSnapshot,
  };
}

function isOrderStatus(value: unknown): value is RetailOrderStatus {
  return value === 'created' || value === 'completed' || value === 'cancelled';
}

function documentToOrder(record: RetailOrderRecord): RetailOrder | undefined {
  const clientId = optionalDocumentText(record.clientId);
  const clientNameSnapshot = optionalDocumentText(record.clientNameSnapshot);
  const orderDate = optionalDocumentText(record.orderDate);
  const deliveryDate = optionalDocumentText(record.deliveryDate);
  const deliveryAddressSnapshot =
    typeof record.deliveryAddressSnapshot === 'string'
      ? record.deliveryAddressSnapshot.trim()
      : undefined;
  const lineItems = Array.isArray(record.lineItems)
    ? record.lineItems.flatMap((lineItem) => {
        const normalized = lineItemFromDocument(lineItem);
        return normalized ? [normalized] : [];
      })
    : [];
  if (
    !record.id ||
    !clientId ||
    !clientNameSnapshot ||
    !orderDate ||
    !deliveryDate ||
    !isStrictRetailIsoDate(orderDate) ||
    !isStrictRetailIsoDate(deliveryDate) ||
    deliveryAddressSnapshot === undefined ||
    !isOrderStatus(record.status) ||
    !isFiniteNonNegative(record.subtotalProducts) ||
    !isFiniteNonNegative(record.discount) ||
    record.discount > record.subtotalProducts ||
    !isFiniteNonNegative(record.deliveryFee) ||
    !isFiniteNonNegative(record.deliveryCost) ||
    !isFiniteNonNegative(record.totalCharged) ||
    !lineItems.length ||
    lineItems.length !== record.lineItems.length
  ) {
    return undefined;
  }
  const expectedTotal = roundRetailOrderMoney(
    record.subtotalProducts - record.discount + record.deliveryFee,
  );
  const expectedSubtotal = roundRetailOrderMoney(
    lineItems.reduce((total, lineItem) => total + lineItem.lineSubtotal, 0),
  );
  if (record.subtotalProducts !== expectedSubtotal || record.totalCharged !== expectedTotal) {
    return undefined;
  }
  return {
    clientId,
    clientNameSnapshot,
    ...(optionalDocumentText(record.clientPhoneSnapshot)
      ? { clientPhoneSnapshot: optionalDocumentText(record.clientPhoneSnapshot) }
      : {}),
    ...(optionalDocumentText(record.clientAddressSnapshot)
      ? { clientAddressSnapshot: optionalDocumentText(record.clientAddressSnapshot) }
      : {}),
    createdAt: record.createdAt as RetailOrder['createdAt'],
    deliveryAddressSnapshot,
    deliveryCost: record.deliveryCost,
    deliveryDate,
    deliveryFee: record.deliveryFee,
    ...(optionalDocumentText(record.notes) ? { notes: optionalDocumentText(record.notes) } : {}),
    ...(optionalDocumentText(record.occasion)
      ? { occasion: optionalDocumentText(record.occasion) }
      : {}),
    orderDate,
    orderId: record.id,
    ...(optionalDocumentText(record.recipient)
      ? { recipient: optionalDocumentText(record.recipient) }
      : {}),
    discount: record.discount,
    lineItems,
    status: record.status,
    subtotalProducts: record.subtotalProducts,
    totalCharged: record.totalCharged,
    updatedAt: record.updatedAt as RetailOrder['updatedAt'],
  };
}

function snapshotForRecords(records: Iterable<RetailOrderRecord>): readonly RetailOrder[] {
  return [...records].flatMap((record) => {
    const order = documentToOrder(record);
    return order ? [order] : [];
  });
}

function sortOrders(orders: readonly RetailOrder[]): RetailOrder[] {
  return orders
    .slice()
    .sort(
      (left, right) =>
        left.deliveryDate.localeCompare(right.deliveryDate) ||
        right.orderDate.localeCompare(left.orderDate) ||
        left.orderId.localeCompare(right.orderId),
    );
}

export type RetailOrderStateErrorCode =
  | 'order_not_found'
  | 'order_not_editable'
  | 'order_has_posted_payment'
  | 'invalid_order_patch'
  | 'invalid_order_status';

export type RetailOrderLoadSource = 'none' | 'cache' | 'local' | 'remote';

export type RetailOrderLoadState = {
  source: RetailOrderLoadSource;
  revalidating: boolean;
  remoteComplete: boolean;
  error?: string;
};

const INITIAL_RETAIL_ORDER_LOAD_STATE: RetailOrderLoadState = {
  remoteComplete: false,
  revalidating: false,
  source: 'none',
};

export class RetailOrderStateError extends Error {
  public readonly code: RetailOrderStateErrorCode;

  public constructor(code: RetailOrderStateErrorCode, message: string) {
    super(message);
    this.name = 'RetailOrderStateError';
    this.code = code;
    Object.setPrototypeOf(this, RetailOrderStateError.prototype);
  }
}

export class RetailOrderDataSource {
  private records = new Map<string, RetailOrderRecord>();
  private snapshot: readonly RetailOrder[] | null = null;
  private readonly listeners = new Set<() => void>();
  private activeUid?: string;
  private sessionUid: string | null | undefined;
  private sessionGeneration = 0;
  private boundSessionVersion: number | undefined;
  private loadEpoch = 0;
  private lastAppliedSource: 'cache' | 'remote' | 'local' | null = null;
  private loadState: RetailOrderLoadState = INITIAL_RETAIL_ORDER_LOAD_STATE;
  private readonly inFlightHydrations = new Map<string, Promise<boolean>>();
  private readonly inFlightLoads = new Map<string, Promise<void>>();

  public constructor(
    private readonly paymentReader: RetailPaymentDataSource = retailPaymentDataSource,
  ) {}

  public getSnapshot = (
    userId?: string,
    sessionVersion?: number,
  ): readonly RetailOrder[] | null => {
    if (!this.isSessionVisible(userId, sessionVersion)) return null;
    return this.snapshot;
  };

  public getLoadState = (userId?: string, sessionVersion?: number): RetailOrderLoadState => {
    if (!this.isSessionVisible(userId, sessionVersion)) return INITIAL_RETAIL_ORDER_LOAD_STATE;
    return this.loadState;
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
    this.records.clear();
    this.snapshot = null;
    this.lastAppliedSource = null;
    this.loadState = INITIAL_RETAIL_ORDER_LOAD_STATE;
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
    const cachedRecords = await retailOrderCatalogCache.read(userId);
    if (
      !this.isSessionRequestCurrent(userId, generation, sessionVersion) ||
      this.loadEpoch !== epoch ||
      this.lastAppliedSource !== null
    ) {
      return false;
    }
    if (!cachedRecords) return false;
    this.records = new Map(cachedRecords.map((record) => [record.id, record]));
    this.snapshot = sortOrders(snapshotForRecords(this.records.values()));
    this.lastAppliedSource = 'cache';
    this.loadState = {
      error: undefined,
      remoteComplete: false,
      revalidating: false,
      source: 'cache',
    };
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

  public async loadHistorical(userId?: string, sessionVersion?: number): Promise<void> {
    if (!userId) throw new Error('Sessão não disponível.');
    const generation = this.beginSessionRequest(userId, sessionVersion);
    if (generation === null) return;
    const epoch = this.loadEpoch;
    const key = `${this.requestKey(userId, generation)}:${epoch}:historical`;
    const existing = this.inFlightLoads.get(key);
    if (existing) return existing;
    const load = this.loadFromFirestore(userId, generation, sessionVersion, epoch, true);
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
    historical = false,
  ): Promise<void> {
    if (historical) {
      this.loadState = {
        error: undefined,
        remoteComplete: false,
        revalidating: true,
        source: this.loadSourceFromLastAppliedSource(),
      };
      this.publish();
    }
    await this.hydrateFromCache(userId, sessionVersion);
    if (
      !this.isSessionRequestCurrent(userId, generation, sessionVersion) ||
      this.loadEpoch !== epoch
    ) {
      return;
    }
    if (historical) {
      this.loadState = {
        error: undefined,
        remoteComplete: false,
        revalidating: true,
        source: this.loadSourceFromLastAppliedSource(),
      };
      this.publish();
    }
    try {
      const firestoreOps = await getFirestoreOps();
      const getDocs =
        historical && firestoreOps.getDocsFromServer
          ? firestoreOps.getDocsFromServer
          : firestoreOps.getDocs;
      const result = (await getDocs(await collectionFor(userId))) as QuerySnapshotLike;
      if (
        !this.isSessionRequestCurrent(userId, generation, sessionVersion) ||
        this.loadEpoch !== epoch
      ) {
        return;
      }
      const loadedRecords = result.docs.map((item) => recordFromDocument(item.id, item.data()));
      const records =
        result.metadata?.fromCache === true
          ? new Map([
              ...this.records.entries(),
              ...loadedRecords.map((record) => [record.id, record] as const),
            ])
          : new Map(loadedRecords.map((record) => [record.id, record] as const));
      this.records = records;
      this.snapshot = sortOrders(snapshotForRecords(records.values()));
      this.lastAppliedSource = result.metadata?.fromCache === true ? 'cache' : 'remote';
      if (result.metadata?.fromCache !== true) {
        void retailOrderCatalogCache.write(userId, [...records.values()]).catch(() => undefined);
      }
      if (historical) {
        const remoteComplete = result.metadata?.fromCache !== true;
        this.loadState = {
          error: remoteComplete ? undefined : 'A atualização remota ainda não foi confirmada.',
          remoteComplete,
          revalidating: false,
          source: remoteComplete ? 'remote' : 'cache',
        };
      }
      this.publish();
    } catch (error) {
      if (
        !this.isSessionRequestCurrent(userId, generation, sessionVersion) ||
        this.loadEpoch !== epoch
      ) {
        return;
      }
      if (historical) {
        this.loadState = {
          error: error instanceof Error ? error.message : 'Não foi possível atualizar o histórico.',
          remoteComplete: false,
          revalidating: false,
          source: this.loadSourceFromLastAppliedSource(),
        };
        this.publish();
      }
      throw error;
    }
  }

  public async loadById(
    orderId: string,
    userId?: string,
    sessionVersion?: number,
  ): Promise<RetailOrder | undefined> {
    if (!userId) throw new Error('Sessão não disponível.');
    assertId(orderId, 'pedido');
    const generation = this.beginSessionRequest(userId, sessionVersion);
    if (generation === null) return undefined;
    const epoch = this.loadEpoch;
    const { doc, getDoc } = await getFirestoreOps();
    const result = (await getDoc(
      doc(await collectionFor(userId), orderId),
    )) as DocumentSnapshotLike;
    if (
      !this.isSessionRequestCurrent(userId, generation, sessionVersion) ||
      this.loadEpoch !== epoch
    ) {
      return undefined;
    }
    if (!result.exists()) {
      this.records.delete(orderId);
      this.rebuildSnapshot();
      this.publish();
      return undefined;
    }
    const data = result.data();
    if (!data) return undefined;
    const record = recordFromDocument(orderId, data);
    this.records.set(orderId, record);
    this.rebuildSnapshot();
    this.publish();
    return documentToOrder(record);
  }

  public list(
    query: RetailOrderQuery = {},
    userId?: string,
    sessionVersion?: number,
  ): RetailOrder[] {
    if (!this.isSessionVisible(userId, sessionVersion) || !this.snapshot) return [];
    return this.snapshot
      .filter((order) => query.includeCancelled === true || order.status !== 'cancelled')
      .filter((order) => !query.clientId || order.clientId === query.clientId)
      .filter((order) => !query.status || order.status === query.status)
      .filter((order) => !query.deliveryDateFrom || order.deliveryDate >= query.deliveryDateFrom)
      .filter((order) => !query.deliveryDateTo || order.deliveryDate <= query.deliveryDateTo)
      .slice();
  }

  public getById(
    orderId: string,
    userId?: string,
    sessionVersion?: number,
  ): RetailOrder | undefined {
    if (!this.isSessionVisible(userId, sessionVersion)) return undefined;
    return this.snapshot?.find((order) => order.orderId === orderId);
  }

  public async create(
    userId: string | undefined,
    input: RetailOrderCreateInput,
    catalog: RetailOrderCatalogContext,
    sessionVersion?: number,
  ): Promise<string> {
    const request = this.captureSessionRequest(userId, sessionVersion);
    const { doc, serverTimestamp, setDoc } = await getFirestoreOps();
    this.assertSessionRequestCurrent(request);
    const reference = doc(await collectionFor(request.userId));
    const order = buildRetailOrderWriteData(reference.id, input, catalog);
    this.assertSessionRequestCurrent(request);
    await setDoc(reference, {
      ...order,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    this.assertSessionRequestCurrent(request);
    this.records.set(reference.id, { id: reference.id, ...order });
    this.rebuildSnapshot();
    this.lastAppliedSource = 'local';
    this.loadState = {
      error: undefined,
      remoteComplete: false,
      revalidating: false,
      source: 'local',
    };
    this.publish();
    void retailOrderCatalogCache
      .write(request.userId, [...this.records.values()])
      .catch(() => undefined);
    return reference.id;
  }

  public async update(
    userId: string | undefined,
    orderId: string,
    patch: RetailOrderPatch,
    sessionVersion?: number,
  ): Promise<void> {
    const request = this.captureSessionRequest(userId, sessionVersion);
    assertId(orderId, 'pedido');
    const current = await this.requireCurrentOrder(orderId, request);
    if (current.status !== 'created') {
      throw new RetailOrderStateError(
        'order_not_editable',
        'Somente pedidos criados podem ser editados.',
      );
    }
    const changesMonetary =
      patch.discount !== undefined ||
      patch.deliveryFee !== undefined ||
      patch.deliveryCost !== undefined;
    if (changesMonetary) await this.assertNoPostedPayments(orderId, request);

    const firestorePatch: Record<string, unknown> = {};
    if (patch.deliveryDate !== undefined) {
      firestorePatch.deliveryDate = normalizeRetailDate(patch.deliveryDate);
    }
    if (patch.deliveryAddressSnapshot !== undefined) {
      firestorePatch.deliveryAddressSnapshot = patch.deliveryAddressSnapshot.trim();
    }
    if (patch.occasion !== undefined) {
      firestorePatch.occasion = patch.occasion?.trim()
        ? patch.occasion.trim()
        : (await getFirestoreOps()).deleteField();
    }
    if (patch.recipient !== undefined) {
      firestorePatch.recipient = patch.recipient?.trim()
        ? patch.recipient.trim()
        : (await getFirestoreOps()).deleteField();
    }
    if (patch.notes !== undefined) {
      firestorePatch.notes = patch.notes?.trim()
        ? patch.notes.trim()
        : (await getFirestoreOps()).deleteField();
    }
    const nextDiscount =
      patch.discount === undefined
        ? current.discount
        : normalizeRetailMoney(patch.discount, 'O desconto');
    const nextDeliveryFee =
      patch.deliveryFee === undefined
        ? current.deliveryFee
        : normalizeRetailMoney(patch.deliveryFee, 'A taxa de entrega');
    const nextDeliveryCost =
      patch.deliveryCost === undefined
        ? current.deliveryCost
        : normalizeRetailMoney(patch.deliveryCost, 'O custo da entrega');
    if (nextDiscount > current.subtotalProducts) {
      throw new RetailOrderStateError(
        'invalid_order_patch',
        'O desconto não pode superar o subtotal do pedido.',
      );
    }
    if (patch.discount !== undefined) firestorePatch.discount = nextDiscount;
    if (patch.deliveryFee !== undefined) firestorePatch.deliveryFee = nextDeliveryFee;
    if (patch.deliveryCost !== undefined) firestorePatch.deliveryCost = nextDeliveryCost;
    if (patch.discount !== undefined) {
      const discountAllocations = allocateDiscountCents(
        current.lineItems.map((lineItem) => moneyToCents(lineItem.lineSubtotal)),
        moneyToCents(nextDiscount),
      );
      firestorePatch.lineItems = current.lineItems.map((lineItem, index) => ({
        ...lineItem,
        discountAllocatedSnapshot: centsToMoney(discountAllocations[index] ?? 0),
      }));
    }
    if (patch.discount !== undefined || patch.deliveryFee !== undefined) {
      firestorePatch.totalCharged = roundRetailOrderMoney(
        current.subtotalProducts - nextDiscount + nextDeliveryFee,
      );
    }
    firestorePatch.updatedAt = (await getFirestoreOps()).serverTimestamp();
    this.assertSessionRequestCurrent(request);
    const { doc, updateDoc } = await getFirestoreOps();
    await updateDoc(doc(await collectionFor(request.userId), orderId), firestorePatch);
    this.assertSessionRequestCurrent(request);
    await this.load(request.userId, request.sessionVersion);
    this.assertSessionRequestCurrent(request);
  }

  public async complete(
    userId: string | undefined,
    orderId: string,
    sessionVersion?: number,
  ): Promise<void> {
    return this.updateStatus(userId, orderId, 'completed', sessionVersion);
  }

  public async cancel(
    userId: string | undefined,
    orderId: string,
    sessionVersion?: number,
  ): Promise<void> {
    return this.updateStatus(userId, orderId, 'cancelled', sessionVersion);
  }

  public async updateStatus(
    userId: string | undefined,
    orderId: string,
    nextStatus: RetailOrderStatus,
    sessionVersion?: number,
  ): Promise<void> {
    const request = this.captureSessionRequest(userId, sessionVersion);
    assertId(orderId, 'pedido');
    if (nextStatus !== 'completed' && nextStatus !== 'cancelled') {
      throw new RetailOrderStateError(
        'invalid_order_status',
        'O status solicitado não é permitido para este pedido.',
      );
    }
    const current = await this.requireCurrentOrder(orderId, request);
    const transitionAllowed =
      (current.status === 'created' &&
        (nextStatus === 'completed' || nextStatus === 'cancelled')) ||
      (current.status === 'completed' && nextStatus === 'cancelled');
    if (!transitionAllowed) {
      throw new RetailOrderStateError(
        'order_not_editable',
        current.status === 'cancelled'
          ? 'O pedido já está cancelado.'
          : 'Esta transição de status não é permitida.',
      );
    }
    const { doc, serverTimestamp, updateDoc } = await getFirestoreOps();
    this.assertSessionRequestCurrent(request);
    await updateDoc(doc(await collectionFor(request.userId), orderId), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
    this.assertSessionRequestCurrent(request);
    this.applyLocalStatus(orderId, current, nextStatus, request.userId);
  }

  private async requireCurrentOrder(
    orderId: string,
    request: SessionRequest,
  ): Promise<RetailOrder> {
    let current = this.getById(orderId, request.userId, request.sessionVersion);
    if (!current) {
      await this.loadById(orderId, request.userId, request.sessionVersion);
      current = this.getById(orderId, request.userId, request.sessionVersion);
    }
    this.assertSessionRequestCurrent(request);
    if (!current) {
      throw new RetailOrderStateError('order_not_found', 'Pedido Varejo não encontrado.');
    }
    return current;
  }

  private async assertNoPostedPayments(orderId: string, request: SessionRequest): Promise<void> {
    await this.paymentReader.load(orderId, request.userId, request.sessionVersion);
    this.assertSessionRequestCurrent(request);
    if (
      this.paymentReader
        .list(orderId, request.userId, request.sessionVersion)
        .some((payment) => payment.status === 'posted')
    ) {
      throw new RetailOrderStateError(
        'order_has_posted_payment',
        'O pedido possui pagamento registrado e precisa de estorno antes da alteração.',
      );
    }
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

  private rebuildSnapshot(): void {
    this.snapshot = sortOrders(snapshotForRecords(this.records.values()));
  }

  private applyLocalStatus(
    orderId: string,
    current: RetailOrder,
    nextStatus: RetailOrderStatus,
    userId: string,
  ): void {
    const currentRecord = this.records.get(orderId);
    this.records.set(orderId, {
      ...(currentRecord ?? { id: orderId, ...current }),
      status: nextStatus,
    });
    this.rebuildSnapshot();
    this.lastAppliedSource = 'local';
    this.loadState = {
      ...this.loadState,
      error: undefined,
      revalidating: false,
      source: 'local',
    };
    this.publish();
    void retailOrderCatalogCache.write(userId, [...this.records.values()]).catch(() => undefined);
  }

  private loadSourceFromLastAppliedSource(): RetailOrderLoadSource {
    return this.lastAppliedSource ?? 'none';
  }

  private publish(): void {
    this.listeners.forEach((listener) => listener());
  }
}

function assertId(value: string, label: string): void {
  if (!value.trim() || value.includes('/')) throw new Error(`ID de ${label} inválido.`);
}

export const retailOrderDataSource = new RetailOrderDataSource();
