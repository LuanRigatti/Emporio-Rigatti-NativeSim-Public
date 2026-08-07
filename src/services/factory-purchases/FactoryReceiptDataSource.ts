import type { FactoryPaymentDraft, FactoryReceipt } from '@/types/data';
import { factoryCalculationService } from '@/services/finance/FactoryCalculationService';
import { normalizeLegacyDate, normalizeMoney } from '@/utils/data';

import { mockFactoryReceiptStorage } from './MockFactoryReceiptStorage';

export type CreateFactoryReceiptInput = {
  date: string;
  quantity: number;
  bucketUnitPrice: number;
};

export interface FactoryReceiptDataSource {
  readonly mode: 'mock';
  restore(): Promise<void>;
  getReceipts(): FactoryReceipt[];
  createReceipt(input: CreateFactoryReceiptInput): FactoryReceipt;
  addPayment(receiptId: string, payment: FactoryPaymentDraft): FactoryReceipt;
  removePayment(receiptId: string, paymentId: string): FactoryReceipt;
  deleteReceipt(receiptId: string): void;
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
  if (!date) throw new Error('Informe uma data vÃ¡lida.');
  return date;
}

function requiredQuantity(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('A quantidade deve ser um nÃºmero inteiro maior que zero.');
  }
  return value;
}

function requiredUnitPrice(value: number): number {
  const price = normalizeMoney(value);
  if (price === undefined || price <= 0) {
    throw new Error('Informe um preÃ§o do balde maior que zero.');
  }
  return Number(price.toFixed(2));
}

export class MockFactoryReceiptDataSource implements FactoryReceiptDataSource {
  public readonly mode = 'mock' as const;
  private receipts = MOCK_RECEIPTS.map(cloneReceipt);
  private hasLocalMutation = false;
  private hydrationPromise: Promise<void> | null = null;

  public restore(): Promise<void> {
    if (this.hydrationPromise) return this.hydrationPromise;

    this.hydrationPromise = mockFactoryReceiptStorage.load().then((receipts) => {
      if (!this.hasLocalMutation) this.receipts = receipts.map(cloneReceipt);
    });
    return this.hydrationPromise;
  }

  public getReceipts(): FactoryReceipt[] {
    return this.receipts.map(cloneReceipt);
  }

  public createReceipt(input: CreateFactoryReceiptInput): FactoryReceipt {
    const quantity = requiredQuantity(input.quantity);
    const date = requiredDate(input.date);
    const unitPrice = requiredUnitPrice(input.bucketUnitPrice);
    const receipt: FactoryReceipt = {
      id: createId('fab'),
      quantidade: quantity,
      data: date,
      valorTotal: Number((quantity * unitPrice).toFixed(2)),
      concluido: false,
      pagamentos: [],
    };

    this.receipts = [receipt, ...this.receipts];
    this.persist();
    return cloneReceipt(receipt);
  }

  public addPayment(receiptId: string, payment: FactoryPaymentDraft): FactoryReceipt {
    const receipt = this.findReceipt(receiptId);
    const date = requiredDate(payment.date);
    const amount = factoryCalculationService.assertPaymentWithinBalance(receipt, payment.amount);
    const updatedReceipt: FactoryReceipt = {
      ...receipt,
      pagamentos: [...receipt.pagamentos, { id: createId('pay'), data: date, valor: amount }],
    };
    updatedReceipt.concluido =
      factoryCalculationService.isWithinSettlementTolerance(updatedReceipt);
    this.replaceReceipt(updatedReceipt);
    return cloneReceipt(updatedReceipt);
  }

  public removePayment(receiptId: string, paymentId: string): FactoryReceipt {
    const receipt = this.findReceipt(receiptId);
    if (!receipt.pagamentos.some((payment) => payment.id === paymentId)) {
      throw new Error('Pagamento da fÃ¡brica nÃ£o encontrado.');
    }

    const updatedReceipt: FactoryReceipt = {
      ...receipt,
      pagamentos: receipt.pagamentos.filter((payment) => payment.id !== paymentId),
    };
    updatedReceipt.concluido =
      factoryCalculationService.isWithinSettlementTolerance(updatedReceipt);
    this.replaceReceipt(updatedReceipt);
    return cloneReceipt(updatedReceipt);
  }

  public deleteReceipt(receiptId: string): void {
    this.findReceipt(receiptId);
    this.receipts = this.receipts.filter((receipt) => receipt.id !== receiptId);
    this.persist();
  }

  private findReceipt(receiptId: string): FactoryReceipt {
    const receipt = this.receipts.find((item) => item.id === receiptId);
    if (!receipt) throw new Error('Compra nÃ£o encontrada.');
    return receipt;
  }

  private replaceReceipt(updatedReceipt: FactoryReceipt): void {
    this.receipts = this.receipts.map((receipt) =>
      receipt.id === updatedReceipt.id ? updatedReceipt : receipt,
    );
    this.persist();
  }

  private persist(): void {
    this.hasLocalMutation = true;
    void mockFactoryReceiptStorage.save(this.receipts);
  }
}

export const mockFactoryReceiptDataSource = new MockFactoryReceiptDataSource();

// FirebaseReceiptDataSource will be connected in the Firebase activation stage.
export const factoryReceiptDataSource: FactoryReceiptDataSource = mockFactoryReceiptDataSource;
