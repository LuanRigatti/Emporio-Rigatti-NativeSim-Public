import type {
  RetailPayment,
  RetailPaymentDraft,
  RetailPaymentMethod,
  RetailPaymentStatus,
} from '@/types/data';
import { assertFirestoreUid } from '@/services/database/firestorePaths';
import { normalizeRetailMoney } from '@/services/retail-costs/retailCostUtils';

import { retailPaymentCatalogCache } from './RetailPaymentCatalogCache';

type RetailPaymentDocument = {
  paymentId?: string;
  amount: number;
  paidAt: string;
  method: RetailPaymentMethod;
  cardFee?: number;
  notes?: string;
  status: RetailPaymentStatus;
  createdAt?: unknown;
};

export type RetailPaymentRecord = RetailPaymentDocument & { id: string };

type SessionRequest = {
  userId: string;
  generation: number;
  sessionVersion?: number;
};

type DocumentSnapshotLike = {
  exists: () => boolean;
  data: () => Record<string, unknown> | undefined;
};

type FirestoreOps = Pick<
  typeof import('firebase/firestore'),
  'collection' | 'doc' | 'getDoc' | 'getDocs' | 'serverTimestamp' | 'setDoc'
>;

let firestoreOpsOverride: FirestoreOps | undefined;
let firestoreDbOverride: unknown | undefined;

export function setFirestoreRetailPaymentDataSourceOpsForTesting(
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

async function getFirestoreDb(): Promise<unknown> {
  if (firestoreDbOverride) return firestoreDbOverride;
  const { getFirebaseFirestore } = await import('@/services/firebase/firestore');
  return getFirebaseFirestore();
}

async function collectionFor(uid: string, orderId: string) {
  assertFirestoreUid(uid);
  assertId(orderId, 'pedido');
  const { collection } = await getFirestoreOps();
  const db = await getFirestoreDb();
  return collection(db as never, 'users', uid, 'retailOrders', orderId, 'payments');
}

async function orderCollectionFor(uid: string) {
  assertFirestoreUid(uid);
  const { collection } = await getFirestoreOps();
  const db = await getFirestoreDb();
  return collection(db as never, 'users', uid, 'retailOrders');
}

function recordFromDocument(id: string, data: Record<string, unknown>): RetailPaymentRecord {
  return { id, ...(data as RetailPaymentDocument) };
}

function documentToPayment(record: RetailPaymentRecord): RetailPayment | undefined {
  if (
    !record.id ||
    !Number.isFinite(record.amount) ||
    record.amount <= 0 ||
    typeof record.paidAt !== 'string' ||
    !record.paidAt.trim() ||
    !isPaymentMethod(record.method) ||
    !isPaymentStatus(record.status) ||
    (record.cardFee !== undefined && (!Number.isFinite(record.cardFee) || record.cardFee < 0))
  ) {
    return undefined;
  }
  const notes = typeof record.notes === 'string' ? record.notes.trim() || undefined : undefined;
  return {
    amount: record.amount,
    ...(record.cardFee === undefined ? {} : { cardFee: record.cardFee }),
    createdAt: record.createdAt as RetailPayment['createdAt'],
    method: record.method,
    ...(notes ? { notes } : {}),
    paidAt: record.paidAt.trim(),
    paymentId: record.id,
    status: record.status,
  };
}

function snapshotForRecords(records: readonly RetailPaymentRecord[]): readonly RetailPayment[] {
  return records.flatMap((record) => {
    const payment = documentToPayment(record);
    return payment ? [payment] : [];
  });
}

function sortPayments(payments: readonly RetailPayment[]): RetailPayment[] {
  return payments
    .slice()
    .sort(
      (left, right) =>
        right.paidAt.localeCompare(left.paidAt) || right.paymentId.localeCompare(left.paymentId),
    );
}

export type RetailPaymentErrorCode =
  'invalid_payment' | 'order_not_found' | 'order_cancelled' | 'payment_exceeds_balance';

export class RetailPaymentError extends Error {
  public readonly code: RetailPaymentErrorCode;

  public constructor(code: RetailPaymentErrorCode, message: string) {
    super(message);
    this.name = 'RetailPaymentError';
    this.code = code;
    Object.setPrototypeOf(this, RetailPaymentError.prototype);
  }
}

export class RetailPaymentDataSource {
  private recordsByOrderId = new Map<string, RetailPaymentRecord[]>();
  private snapshotsByOrderId = new Map<string, readonly RetailPayment[]>();
  private readonly listeners = new Set<() => void>();
  private activeUid?: string;
  private sessionUid: string | null | undefined;
  private sessionGeneration = 0;
  private boundSessionVersion: number | undefined;
  private loadEpoch = 0;
  private readonly inFlightHydrations = new Map<string, Promise<boolean>>();
  private readonly inFlightLoads = new Map<string, Promise<void>>();

  public getSnapshot = (
    orderId: string,
    userId?: string,
    sessionVersion?: number,
  ): readonly RetailPayment[] | null => {
    if (!this.isSessionVisible(userId, sessionVersion)) return null;
    return this.snapshotsByOrderId.get(orderId) ?? null;
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
    this.recordsByOrderId.clear();
    this.snapshotsByOrderId.clear();
    this.publish();
  }

  public async hydrateFromCache(
    orderId: string,
    userId: string,
    sessionVersion?: number,
  ): Promise<boolean> {
    assertId(orderId, 'pedido');
    const generation = this.beginSessionRequest(userId, sessionVersion);
    if (generation === null) return false;
    const key = this.orderRequestKey(userId, generation, orderId);
    const existing = this.inFlightHydrations.get(key);
    if (existing) return existing;
    const epoch = this.loadEpoch;
    const hydration = this.hydrateFromCacheInternal(
      orderId,
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
    orderId: string,
    userId: string,
    generation: number,
    sessionVersion: number | undefined,
    epoch: number,
  ): Promise<boolean> {
    const cachedRecords = await retailPaymentCatalogCache.read(userId, orderId);
    if (
      !this.isSessionRequestCurrent(userId, generation, sessionVersion) ||
      this.loadEpoch !== epoch ||
      this.snapshotsByOrderId.has(orderId)
    ) {
      return false;
    }
    if (!cachedRecords) return false;
    this.recordsByOrderId.set(orderId, cachedRecords);
    this.snapshotsByOrderId.set(orderId, sortPayments(snapshotForRecords(cachedRecords)));
    this.publish();
    return true;
  }

  public async load(orderId: string, userId?: string, sessionVersion?: number): Promise<void> {
    if (!userId) throw new Error('Sessão não disponível.');
    assertId(orderId, 'pedido');
    const generation = this.beginSessionRequest(userId, sessionVersion);
    if (generation === null) return;
    const epoch = this.loadEpoch;
    const key = `${this.orderRequestKey(userId, generation, orderId)}:${epoch}`;
    const existing = this.inFlightLoads.get(key);
    if (existing) return existing;
    const load = this.loadFromFirestore(orderId, userId, generation, sessionVersion, epoch);
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
    orderId: string,
    userId: string,
    generation: number,
    sessionVersion: number | undefined,
    epoch: number,
  ): Promise<void> {
    await this.hydrateFromCache(orderId, userId, sessionVersion);
    if (
      !this.isSessionRequestCurrent(userId, generation, sessionVersion) ||
      this.loadEpoch !== epoch
    ) {
      return;
    }
    try {
      const { getDocs } = await getFirestoreOps();
      const result = await getDocs(await collectionFor(userId, orderId));
      if (
        !this.isSessionRequestCurrent(userId, generation, sessionVersion) ||
        this.loadEpoch !== epoch
      ) {
        return;
      }
      const loadedRecords = result.docs.map((item) => recordFromDocument(item.id, item.data()));
      const currentRecords =
        result.metadata?.fromCache === true
          ? [
              ...new Map([
                ...(this.recordsByOrderId.get(orderId) ?? []).map(
                  (record) => [record.id, record] as const,
                ),
                ...loadedRecords.map((record) => [record.id, record] as const),
              ]).values(),
            ]
          : loadedRecords;
      this.recordsByOrderId.set(orderId, currentRecords);
      this.snapshotsByOrderId.set(orderId, sortPayments(snapshotForRecords(currentRecords)));
      if (result.metadata?.fromCache !== true) {
        void retailPaymentCatalogCache
          .write(userId, orderId, currentRecords)
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

  public list(orderId: string, userId?: string, sessionVersion?: number): RetailPayment[] {
    if (!this.isSessionVisible(userId, sessionVersion)) return [];
    return sortPayments(this.snapshotsByOrderId.get(orderId) ?? []);
  }

  public async register(
    userId: string | undefined,
    orderId: string,
    input: RetailPaymentDraft,
    sessionVersion?: number,
  ): Promise<string> {
    const request = this.captureSessionRequest(userId, sessionVersion);
    assertId(orderId, 'pedido');
    const amount = normalizeRetailMoney(input.amount, 'O pagamento');
    if (amount <= 0) {
      throw new RetailPaymentError('invalid_payment', 'O pagamento deve ser maior que zero.');
    }
    const paidAt = input.paidAt.trim();
    if (!paidAt) throw new RetailPaymentError('invalid_payment', 'Informe a data do pagamento.');
    if (!isPaymentMethod(input.method)) {
      throw new RetailPaymentError('invalid_payment', 'O método de pagamento é inválido.');
    }
    const status = input.status ?? 'posted';
    if (!isPaymentStatus(status)) {
      throw new RetailPaymentError('invalid_payment', 'O status do pagamento é inválido.');
    }
    const cardFee =
      input.cardFee === undefined
        ? undefined
        : normalizeRetailMoney(input.cardFee, 'A taxa do cartão');
    const notes = input.notes?.trim() || undefined;
    const { doc, getDoc, serverTimestamp, setDoc } = await getFirestoreOps();
    this.assertSessionRequestCurrent(request);
    const orderCollection = await orderCollectionFor(request.userId);
    const paymentCollection = await collectionFor(request.userId, orderId);
    const orderSnapshot = (await getDoc(
      doc(orderCollection, orderId),
    )) as unknown as DocumentSnapshotLike;
    if (!orderSnapshot.exists()) {
      throw new RetailPaymentError('order_not_found', 'Pedido Varejo não encontrado.');
    }
    const orderData = orderSnapshot.data();
    if (orderData?.status === 'cancelled') {
      throw new RetailPaymentError(
        'order_cancelled',
        'Não é possível registrar pagamento em pedido cancelado.',
      );
    }
    const totalCharged = orderData?.totalCharged;
    if (typeof totalCharged !== 'number' || !Number.isFinite(totalCharged)) {
      throw new RetailPaymentError('order_not_found', 'O total do pedido é inválido.');
    }
    await this.load(orderId, request.userId, request.sessionVersion);
    this.assertSessionRequestCurrent(request);
    const paidAmount = this.list(orderId, request.userId, request.sessionVersion).reduce(
      (total, payment) => total + (payment.status === 'posted' ? payment.amount : 0),
      0,
    );
    if (amount > Math.max(0, totalCharged - paidAmount)) {
      throw new RetailPaymentError(
        'payment_exceeds_balance',
        'O pagamento não pode superar o saldo em aberto do pedido.',
      );
    }
    const paymentReference = doc(paymentCollection);
    await setDoc(paymentReference, {
      amount,
      ...(cardFee === undefined ? {} : { cardFee }),
      createdAt: serverTimestamp(),
      method: input.method,
      paidAt,
      paymentId: paymentReference.id,
      ...(notes ? { notes } : {}),
      status,
    });
    const paymentId = paymentReference.id;
    this.assertSessionRequestCurrent(request);
    const currentRecords = this.recordsByOrderId.get(orderId) ?? [];
    const localRecord: RetailPaymentRecord = {
      amount,
      ...(cardFee === undefined ? {} : { cardFee }),
      id: paymentId,
      method: input.method,
      notes,
      paidAt,
      paymentId,
      status,
    };
    const nextRecords = [
      ...currentRecords.filter((record) => record.id !== paymentId),
      localRecord,
    ];
    this.recordsByOrderId.set(orderId, nextRecords);
    this.snapshotsByOrderId.set(orderId, sortPayments(snapshotForRecords(nextRecords)));
    this.publish();
    void retailPaymentCatalogCache
      .write(request.userId, orderId, nextRecords)
      .catch(() => undefined);
    return paymentId;
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

  private orderRequestKey(userId: string, generation: number, orderId: string): string {
    return `${userId}:${generation}:${orderId}`;
  }

  private publish(): void {
    this.listeners.forEach((listener) => listener());
  }
}

function isPaymentMethod(value: unknown): value is RetailPaymentMethod {
  return ['Pix', 'Dinheiro', 'Crédito', 'Débito', 'Outro'].includes(value as string);
}

function isPaymentStatus(value: unknown): value is RetailPaymentStatus {
  return value === 'posted' || value === 'voided';
}

function assertId(value: string, label: string): void {
  if (!value.trim() || value.includes('/')) throw new Error(`ID de ${label} inválido.`);
}

export const retailPaymentDataSource = new RetailPaymentDataSource();
