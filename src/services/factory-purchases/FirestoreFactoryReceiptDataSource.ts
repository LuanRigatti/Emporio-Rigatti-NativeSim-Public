import type {
  FactoryFilters,
  FactoryPayment,
  FactoryPaymentDraft,
  FactoryReceipt,
} from '@/types/data';
import { factoryCalculationService } from '@/services/finance/FactoryCalculationService';
import { normalizeLegacyDate, normalizeMoney } from '@/utils/data';
import type { DocumentReference } from 'firebase/firestore';

import type {
  CreateFactoryReceiptInput,
  FactoryReceiptDataSource,
} from './FactoryReceiptDataSource';

type FirestoreFactoryReceiptDocument = {
  quantity: number;
  date: string;
  historicalUnitPrice?: number;
  totalValue: number;
  completed: boolean;
  legacyFields?: Record<string, unknown>;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type FirestoreFactoryPaymentDocument = {
  date: string;
  amount: number;
  legacyFields?: Record<string, unknown>;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function cloneReceipt(receipt: FactoryReceipt): FactoryReceipt {
  return {
    ...receipt,
    pagamentos: receipt.pagamentos.map((payment) => ({
      ...payment,
      ...(payment.legacyFields ? { legacyFields: { ...payment.legacyFields } } : {}),
    })),
    ...(receipt.legacyFields ? { legacyFields: { ...receipt.legacyFields } } : {}),
  };
}

function requiredDate(value: string): string {
  const date = normalizeLegacyDate(value);
  if (!date) throw new Error('Informe uma data vÃƒÂ¡lida.');
  return date;
}

function requiredQuantity(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('A quantidade deve ser um nÃƒÂºmero inteiro maior que zero.');
  }
  return value;
}

function requiredUnitPrice(value: number): number {
  const price = normalizeMoney(value);
  if (price === undefined || price <= 0) {
    throw new Error('Informe um preÃƒÂ§o do balde maior que zero.');
  }
  return Number(price.toFixed(2));
}

function monthEnd(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error('PerÃƒÂ­odo mensal invÃƒÂ¡lido.');
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) throw new Error('PerÃƒÂ­odo mensal invÃƒÂ¡lido.');
  return `${year}-${String(monthNumber).padStart(2, '0')}-${new Date(Date.UTC(year, monthNumber, 0))
    .getUTCDate()
    .toString()
    .padStart(2, '0')}`;
}

async function receiptCollection(uid: string) {
  const { collection } = await import('firebase/firestore');
  const { getFirebaseFirestore } = await import('@/services/firebase/firestore');
  return collection(getFirebaseFirestore(), 'users', uid, 'factoryReceipts');
}

async function paymentsCollection(receiptReference: DocumentReference) {
  const { collection } = await import('firebase/firestore');
  return collection(receiptReference, 'payments');
}

function mapPayment(id: string, document: FirestoreFactoryPaymentDocument): FactoryPayment {
  return {
    id,
    data: document.date,
    valor: document.amount,
    ...(document.legacyFields ? { legacyFields: document.legacyFields } : {}),
  };
}

function maskReceiptId(receiptId: string): string {
  return receiptId.length <= 8 ? receiptId : `${receiptId.slice(0, 4)}…${receiptId.slice(-4)}`;
}

function logPayment(message: string, details: Record<string, unknown>): void {
  if (__DEV__) console.log(`[FirestoreFactoryReceiptDataSource] ${message}`, details);
}

async function mapReceipt(
  id: string,
  document: FirestoreFactoryReceiptDocument,
  receiptReference: DocumentReference,
  cachedReceipt?: FactoryReceipt,
): Promise<FactoryReceipt> {
  let createdAt: string | undefined;
  if (document.createdAt) {
    if (typeof document.createdAt === 'string') {
      createdAt = document.createdAt;
    } else if (typeof (document.createdAt as { toDate?: () => Date }).toDate === 'function') {
      createdAt = (document.createdAt as { toDate: () => Date }).toDate().toISOString();
    }
  }

  const { getDocs } = await import('firebase/firestore');
  const paymentsSnapshot = await getDocs(await paymentsCollection(receiptReference));
  const pagamentos = paymentsSnapshot.docs.map((payment) =>
    mapPayment(payment.id, payment.data() as FirestoreFactoryPaymentDocument),
  );

  return {
    id,
    quantidade: document.quantity,
    data: document.date,
    ...(document.historicalUnitPrice === undefined
      ? {}
      : { precoUnitarioHistorico: document.historicalUnitPrice }),
    valorTotal: document.totalValue,
    concluido: document.completed,
    pagamentos,
    ...(createdAt
      ? { createdAt }
      : cachedReceipt?.createdAt
        ? { createdAt: cachedReceipt.createdAt }
        : {}),
    ...(document.legacyFields ? { legacyFields: document.legacyFields } : {}),
  };
}

export class FirestoreFactoryReceiptDataSource implements FactoryReceiptDataSource {
  public readonly mode = 'firebase' as const;
  public isUsingLocalFallback = false;
  private readonly receipts = new Map<string, FactoryReceipt>();
  private readonly listeners = new Set<() => void>();
  private readonly paymentMutationQueues = new Map<string, Promise<unknown>>();
  private userId: string | undefined;
  private mutationVersion = 0;
  private restoreRequestId = 0;

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(): void {
    this.listeners.forEach((listener) => listener());
  }

  public getReceipts = (): FactoryReceipt[] => [...this.receipts.values()].map(cloneReceipt);

  public async restore(
    userId?: string,
    filters: FactoryFilters = { period: 'all' },
  ): Promise<void> {
    const restoreRequestId = ++this.restoreRequestId;
    const mutationVersionAtStart = this.mutationVersion;
    const canApply = () =>
      restoreRequestId === this.restoreRequestId &&
      mutationVersionAtStart === this.mutationVersion;

    if (!userId) {
      await this.restoreLocalFallback();
      return;
    }
    this.userId = userId;

    try {
      const { getDocs, query, where } = await import('firebase/firestore');
      const collectionReference = await receiptCollection(userId);
      const constraints: Parameters<typeof query>[1][] = [];
      let minDate: string | undefined;
      let maxDate: string | undefined;

      if (filters.completed !== undefined) {
        constraints.push(where('completed', '==', filters.completed));
      }
      if (filters.period === 'month' && filters.month) {
        minDate = `${filters.month}-01`;
        maxDate = monthEnd(filters.month);
        constraints.push(where('date', '>=', minDate));
        constraints.push(where('date', '<=', maxDate));
      } else {
        if (filters.startDate) {
          minDate = filters.startDate;
          constraints.push(where('date', '>=', filters.startDate));
        }
        if (filters.endDate) {
          maxDate = filters.endDate;
          constraints.push(where('date', '<=', filters.endDate));
        }
      }
      const result = await getDocs(
        constraints.length ? query(collectionReference, ...constraints) : collectionReference,
      );
      const mapped = await Promise.all(
        result.docs.map((item) =>
          mapReceipt(
            item.id,
            item.data() as FirestoreFactoryReceiptDocument,
            item.ref,
            this.receipts.get(item.id),
          ),
        ),
      );

      if (!canApply()) return;

      const returnedIds = new Set(mapped.map((r) => r.id));

      if (minDate || maxDate) {
        for (const [id, receipt] of this.receipts) {
          const inRange =
            (!minDate || receipt.data >= minDate) && (!maxDate || receipt.data <= maxDate);
          if (inRange && !returnedIds.has(id)) {
            this.receipts.delete(id);
          }
        }
      } else if (
        filters.period === 'all' &&
        !filters.startDate &&
        !filters.endDate &&
        filters.completed === undefined
      ) {
        this.receipts.clear();
      }

      mapped.forEach((receipt) => this.receipts.set(receipt.id, receipt));
      this.isUsingLocalFallback = false;
      this.publish();
    } catch (error) {
      if (!canApply()) return;
      await this.restoreLocalFallback();
      if (__DEV__) console.warn('[FirestoreFactoryReceiptDataSource] Fallback local.', error);
    }
  }

  public async createReceipt(input: CreateFactoryReceiptInput): Promise<FactoryReceipt> {
    if (this.isUsingLocalFallback) {
      const receipt = await (await this.localSource()).createReceipt(input);
      await this.syncFromLocal();
      this.publish();
      return receipt;
    }
    const quantity = requiredQuantity(input.quantity);
    const date = requiredDate(input.date);
    const historicalUnitPrice = requiredUnitPrice(input.bucketUnitPrice);
    const now = new Date().toISOString();
    const { doc, serverTimestamp, setDoc } = await import('firebase/firestore');
    const reference = doc(await receiptCollection(this.requireUserId()));
    const created: FactoryReceipt = {
      id: reference.id,
      quantidade: quantity,
      data: date,
      precoUnitarioHistorico: historicalUnitPrice,
      valorTotal: Number((quantity * historicalUnitPrice).toFixed(2)),
      concluido: false,
      pagamentos: [],
      createdAt: now,
    };

    this.receipts.set(created.id, created);
    this.publish();

    try {
      await setDoc(reference, {
        quantity: created.quantidade,
        date: created.data,
        historicalUnitPrice,
        totalValue: created.valorTotal,
        completed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } satisfies FirestoreFactoryReceiptDocument);
      return cloneReceipt(created);
    } catch (error) {
      this.receipts.delete(created.id);
      this.publish();
      throw error;
    }
  }

  public async addPayment(
    receiptId: string,
    payment: FactoryPaymentDraft,
  ): Promise<FactoryReceipt> {
    return this.enqueuePaymentMutation(receiptId, async () => {
      this.mutationVersion += 1;
      if (this.isUsingLocalFallback) {
        const receipt = await (await this.localSource()).addPayment(receiptId, payment);
        await this.syncFromLocal();
        this.publish();
        return receipt;
      }
      const maskedReceiptId = maskReceiptId(receiptId);
      try {
        const receipt = await this.ensureReceipt(receiptId);
        const date = requiredDate(payment.date);
        const amount = factoryCalculationService.assertPaymentWithinBalance(
          receipt,
          payment.amount,
        );
        const balanceBefore = factoryCalculationService.openValue(receipt);
        const { doc, serverTimestamp, writeBatch } = await import('firebase/firestore');
        const { getFirebaseFirestore } = await import('@/services/firebase/firestore');
        const receiptReference = doc(await receiptCollection(this.requireUserId()), receiptId);
        const paymentReference = doc(await paymentsCollection(receiptReference));
        const nextPayment: FactoryPayment = { id: paymentReference.id, data: date, valor: amount };
        const updatedReceipt: FactoryReceipt = {
          ...receipt,
          pagamentos: [...receipt.pagamentos, nextPayment],
        };
        updatedReceipt.concluido =
          factoryCalculationService.isWithinSettlementTolerance(updatedReceipt);
        const balanceAfter = factoryCalculationService.openValue(updatedReceipt);
        logPayment('paymentWriteStarted', {
          amount,
          balanceBefore,
          balanceAfter,
          paymentId: maskReceiptId(paymentReference.id),
          receiptId: maskedReceiptId,
          target: `users/{uid}/factoryReceipts/${maskedReceiptId}/payments/{paymentId}`,
        });
        const batch = writeBatch(getFirebaseFirestore());
        batch.set(paymentReference, {
          date,
          amount,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } satisfies FirestoreFactoryPaymentDocument);
        batch.update(receiptReference, {
          completed: updatedReceipt.concluido,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        this.receipts.set(receiptId, updatedReceipt);
        this.publish();
        logPayment('paymentWriteSucceeded', {
          balanceAfter,
          paymentId: maskReceiptId(paymentReference.id),
          receiptId: maskedReceiptId,
        });
        return cloneReceipt(updatedReceipt);
      } catch (error) {
        logPayment('paymentWriteFailed', {
          error: error instanceof Error ? error.message : 'unknown',
          receiptId: maskedReceiptId,
        });
        throw error;
      }
    });
  }

  public async removePayment(receiptId: string, paymentId: string): Promise<FactoryReceipt> {
    return this.enqueuePaymentMutation(receiptId, async () => {
      this.mutationVersion += 1;
      if (this.isUsingLocalFallback) {
        const receipt = await (await this.localSource()).removePayment(receiptId, paymentId);
        await this.syncFromLocal();
        this.publish();
        return receipt;
      }
      const receipt = await this.ensureReceipt(receiptId);
      if (!receipt.pagamentos.some((payment) => payment.id === paymentId)) {
        throw new Error('Pagamento da fábrica não encontrado.');
      }
      const updatedReceipt: FactoryReceipt = {
        ...receipt,
        pagamentos: receipt.pagamentos.filter((payment) => payment.id !== paymentId),
      };
      updatedReceipt.concluido =
        factoryCalculationService.isWithinSettlementTolerance(updatedReceipt);
      const { doc, serverTimestamp, writeBatch } = await import('firebase/firestore');
      const receiptReference = doc(await receiptCollection(this.requireUserId()), receiptId);
      const paymentReference = doc(await paymentsCollection(receiptReference), paymentId);
      const batch = writeBatch(receiptReference.firestore);
      batch.delete(paymentReference);
      batch.update(receiptReference, {
        completed: updatedReceipt.concluido,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      this.receipts.set(receiptId, updatedReceipt);
      this.publish();
      return cloneReceipt(updatedReceipt);
    });
  }

  public async deleteReceipt(receiptId: string): Promise<void> {
    if (this.isUsingLocalFallback) {
      await (await this.localSource()).deleteReceipt(receiptId);
      await this.syncFromLocal();
      this.publish();
      return;
    }
    const receipt = await this.ensureReceipt(receiptId);
    const { doc, writeBatch } = await import('firebase/firestore');
    const receiptReference = doc(await receiptCollection(this.requireUserId()), receiptId);
    const batch = writeBatch(receiptReference.firestore);
    const paymentReferences = await Promise.all(
      receipt.pagamentos.map(async (payment) =>
        doc(await paymentsCollection(receiptReference), payment.id),
      ),
    );
    paymentReferences.forEach((paymentReference) => batch.delete(paymentReference));
    batch.delete(receiptReference);
    await batch.commit();
    this.receipts.delete(receiptId);
    this.publish();
  }

  private async ensureReceipt(receiptId: string): Promise<FactoryReceipt> {
    const cached = this.receipts.get(receiptId);
    if (cached) return cloneReceipt(cached);
    await this.restore(this.requireUserId());
    const restored = this.receipts.get(receiptId);
    if (!restored) throw new Error('Compra não encontrada.');
    return cloneReceipt(restored);
  }

  private enqueuePaymentMutation<T>(
    receiptId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.paymentMutationQueues.get(receiptId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    this.paymentMutationQueues.set(receiptId, next);
    const cleanup = () => {
      if (this.paymentMutationQueues.get(receiptId) === next) {
        this.paymentMutationQueues.delete(receiptId);
      }
    };
    void next.then(cleanup, cleanup);
    return next;
  }

  private requireUserId(): string {
    if (this.userId) return this.userId;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getFirebaseAuth } = require('@/services/firebase/auth');
      const currentUid = getFirebaseAuth()?.currentUser?.uid;
      if (currentUid) {
        this.userId = currentUid;
        return currentUid;
      }
    } catch {
      // ignore
    }
    throw new Error('Sessão Firebase necessária para esta operação.');
  }

  private async restoreLocalFallback(): Promise<void> {
    const { mockFactoryReceiptDataSource } = await import('./FactoryReceiptDataSource');
    await mockFactoryReceiptDataSource.restore();
    this.receipts.clear();
    mockFactoryReceiptDataSource.getReceipts().forEach((receipt) => {
      this.receipts.set(receipt.id, cloneReceipt(receipt));
    });
    this.isUsingLocalFallback = true;
    this.publish();
  }

  private async localSource() {
    const { mockFactoryReceiptDataSource } = await import('./FactoryReceiptDataSource');
    return mockFactoryReceiptDataSource;
  }

  private async syncFromLocal(): Promise<void> {
    const local = await this.localSource();
    this.receipts.clear();
    local.getReceipts().forEach((receipt) => this.receipts.set(receipt.id, cloneReceipt(receipt)));
  }
}

export const firestoreFactoryReceiptDataSource = new FirestoreFactoryReceiptDataSource();
