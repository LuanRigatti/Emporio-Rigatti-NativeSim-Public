import { ENABLE_FIRESTORE_FACTORY_RECEIPTS } from '@/config/featureFlags';
import type { FactoryFilters, FactoryPaymentDraft, FactoryReceipt } from '@/types/data';
import { factoryCalculationService } from '@/services/finance/FactoryCalculationService';
import { normalizeLegacyDate, normalizeMoney } from '@/utils/data';

import { mockFactoryReceiptStorage } from './MockFactoryReceiptStorage';
import { firestoreFactoryReceiptDataSource } from './FirestoreFactoryReceiptDataSource';

export type CreateFactoryReceiptInput = {
  date: string;
  quantity: number;
  bucketUnitPrice: number;
};

export interface FactoryReceiptDataSource {
  readonly mode: 'mock' | 'firebase';
  readonly isDataUnavailable?: boolean;
  restore(userId?: string, filters?: FactoryFilters, sessionVersion?: number): Promise<void>;
  getReceipts(userId?: string, sessionVersion?: number): FactoryReceipt[];
  createReceipt(input: CreateFactoryReceiptInput): Promise<FactoryReceipt>;
  addPayment(receiptId: string, payment: FactoryPaymentDraft): Promise<FactoryReceipt>;
  removePayment(receiptId: string, paymentId: string): Promise<FactoryReceipt>;
  deleteReceipt(receiptId: string): Promise<void>;
  subscribe(listener: () => void): () => void;
}

const MOCK_RECEIPTS: FactoryReceipt[] = [];

function createId(prefix: 'fab' | 'pay'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1_000_000).toString(36)}`;
}

function cloneReceipt(receipt: FactoryReceipt): FactoryReceipt {
  return {
    ...receipt,
    pagamentos: receipt.pagamentos.map((payment) => ({ ...payment })),
  };
}

function requiredDate(value: string): string {
  const date = normalizeLegacyDate(value);
  if (!date) throw new Error('Informe uma data válida.');
  return date;
}

function requiredQuantity(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('A quantidade deve ser um número inteiro maior que zero.');
  }
  return value;
}

function requiredUnitPrice(value: number): number {
  const price = normalizeMoney(value);
  if (price === undefined || price <= 0) {
    throw new Error('Informe um preço do balde maior que zero.');
  }
  return Number(price.toFixed(2));
}

export class MockFactoryReceiptDataSource implements FactoryReceiptDataSource {
  public readonly mode = 'mock' as const;
  private receipts = MOCK_RECEIPTS.map(cloneReceipt);
  private hasLocalMutation = false;
  private hydrationPromise: Promise<void> | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly paymentMutationQueues = new Map<string, Promise<unknown>>();

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(): void {
    this.listeners.forEach((listener) => listener());
  }

  public restore(
    _userId?: string,
    _filters?: FactoryFilters,
    _sessionVersion?: number,
  ): Promise<void> {
    if (this.hydrationPromise) return this.hydrationPromise;

    this.hydrationPromise = mockFactoryReceiptStorage.load().then((receipts) => {
      if (!this.hasLocalMutation) {
        this.receipts = receipts.map(cloneReceipt);
        this.publish();
      }
    });
    return this.hydrationPromise;
  }

  public getReceipts(_userId?: string, _sessionVersion?: number): FactoryReceipt[] {
    return this.receipts.map(cloneReceipt);
  }

  public async createReceipt(input: CreateFactoryReceiptInput): Promise<FactoryReceipt> {
    await this.restore();
    const quantity = requiredQuantity(input.quantity);
    const date = requiredDate(input.date);
    const unitPrice = requiredUnitPrice(input.bucketUnitPrice);
    const receipt: FactoryReceipt = {
      id: createId('fab'),
      quantidade: quantity,
      data: date,
      precoUnitarioHistorico: unitPrice,
      valorTotal: Number((quantity * unitPrice).toFixed(2)),
      concluido: false,
      pagamentos: [],
      createdAt: new Date().toISOString(),
    };

    this.receipts = [receipt, ...this.receipts];
    await this.persist();
    this.publish();
    return cloneReceipt(receipt);
  }

  public async addPayment(
    receiptId: string,
    payment: FactoryPaymentDraft,
  ): Promise<FactoryReceipt> {
    return this.enqueuePaymentMutation(receiptId, async () => {
      await this.restore();
      const receipt = this.findReceipt(receiptId);
      const date = requiredDate(payment.date);
      const amount = factoryCalculationService.assertPaymentWithinBalance(receipt, payment.amount);
      const updatedReceipt: FactoryReceipt = {
        ...receipt,
        pagamentos: [...receipt.pagamentos, { id: createId('pay'), data: date, valor: amount }],
      };
      updatedReceipt.concluido =
        factoryCalculationService.isWithinSettlementTolerance(updatedReceipt);
      await this.replaceReceipt(updatedReceipt);
      this.publish();
      return cloneReceipt(updatedReceipt);
    });
  }

  public async removePayment(receiptId: string, paymentId: string): Promise<FactoryReceipt> {
    return this.enqueuePaymentMutation(receiptId, async () => {
      await this.restore();
      const receipt = this.findReceipt(receiptId);
      if (!receipt.pagamentos.some((payment) => payment.id === paymentId)) {
        throw new Error('Pagamento da fábrica não encontrado.');
      }

      const updatedReceipt: FactoryReceipt = {
        ...receipt,
        pagamentos: receipt.pagamentos.filter((payment) => payment.id !== paymentId),
      };
      updatedReceipt.concluido =
        factoryCalculationService.isWithinSettlementTolerance(updatedReceipt);
      await this.replaceReceipt(updatedReceipt);
      this.publish();
      return cloneReceipt(updatedReceipt);
    });
  }

  public async deleteReceipt(receiptId: string): Promise<void> {
    await this.restore();
    this.findReceipt(receiptId);
    this.receipts = this.receipts.filter((receipt) => receipt.id !== receiptId);
    await this.persist();
    this.publish();
  }

  private findReceipt(receiptId: string): FactoryReceipt {
    const receipt = this.receipts.find((item) => item.id === receiptId);
    if (!receipt) throw new Error('Compra não encontrada.');
    return receipt;
  }

  private async replaceReceipt(updatedReceipt: FactoryReceipt): Promise<void> {
    this.receipts = this.receipts.map((receipt) =>
      receipt.id === updatedReceipt.id ? updatedReceipt : receipt,
    );
    await this.persist();
  }

  private async persist(): Promise<void> {
    this.hasLocalMutation = true;
    await mockFactoryReceiptStorage.save(this.receipts);
  }

  private enqueuePaymentMutation<T>(receiptId: string, operation: () => Promise<T>): Promise<T> {
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
}

export const mockFactoryReceiptDataSource = new MockFactoryReceiptDataSource();

export const factoryReceiptDataSource: FactoryReceiptDataSource = ENABLE_FIRESTORE_FACTORY_RECEIPTS
  ? firestoreFactoryReceiptDataSource
  : mockFactoryReceiptDataSource;
