import type {
  FactoryPayment,
  FactoryPaymentDraft,
  FactoryReceipt,
  FactoryReceiptDraft,
} from '@/types/data';
import { FactoryReceiptRepository } from '@/repositories/FactoryReceiptRepository';
import { asyncStorageCacheService } from '@/services/cache';
import { userDataService, type UserDataSnapshot } from '@/services/data';
import { expenseCalculationService } from '@/services/expenses/ExpenseCalculationService';
import { normalizeLegacyDate } from '@/utils/data';

import { factoryCalculationService } from './FactoryCalculationService';

function createId(prefix: 'fab' | 'pay'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1_000_000).toString(36)}`;
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

export class FactoryReceiptMutationService {
  public constructor(
    private readonly uid: string,
    private readonly readSnapshot: () => Promise<UserDataSnapshot> = () =>
      userDataService.readFromFirebase(uid),
  ) {}

  private async replace(
    snapshot: UserDataSnapshot,
    receipts: FactoryReceipt[],
  ): Promise<UserDataSnapshot> {
    await new FactoryReceiptRepository(this.uid).replace(receipts);
    const nextSnapshot = { ...snapshot, recebimentoBaldes: receipts };
    await asyncStorageCacheService.write(this.uid, nextSnapshot);
    return nextSnapshot;
  }

  public async create(draft: FactoryReceiptDraft): Promise<FactoryReceipt> {
    const date = requiredDate(draft.date);
    const quantity = requiredQuantity(draft.quantity);
    const value = Number(
      (quantity * expenseCalculationService.calculateBucketCost(date)).toFixed(2),
    );
    const snapshot = await this.readSnapshot();
    const receipt: FactoryReceipt = {
      id: createId('fab'),
      quantidade: quantity,
      data: date,
      valorTotal: value,
      concluido: false,
      pagamentos: [],
    };
    await this.replace(snapshot, [...snapshot.recebimentoBaldes, receipt]);
    return receipt;
  }

  public async addPayment(receiptId: string, draft: FactoryPaymentDraft): Promise<FactoryReceipt> {
    const date = requiredDate(draft.date);
    const snapshot = await this.readSnapshot();
    const receipt = snapshot.recebimentoBaldes.find((item) => item.id === receiptId);
    if (!receipt) throw new Error('Recebimento da fábrica não encontrado.');

    const amount = factoryCalculationService.assertPaymentWithinBalance(receipt, draft.amount);
    const payment: FactoryPayment = { id: createId('pay'), data: date, valor: amount };
    const payments = [...receipt.pagamentos, payment];
    const updatedReceipt: FactoryReceipt = {
      ...receipt,
      pagamentos: payments,
      concluido:
        Math.abs(receipt.valorTotal - payments.reduce((sum, item) => sum + item.valor, 0)) < 0.01
          ? true
          : receipt.concluido,
    };
    const receipts = snapshot.recebimentoBaldes.map((item) =>
      item.id === receiptId ? updatedReceipt : item,
    );
    await this.replace(snapshot, receipts);
    return updatedReceipt;
  }

  public async removePayment(receiptId: string, paymentId: string): Promise<FactoryReceipt> {
    const snapshot = await this.readSnapshot();
    const receipt = snapshot.recebimentoBaldes.find((item) => item.id === receiptId);
    if (!receipt) throw new Error('Recebimento da fábrica não encontrado.');
    if (!receipt.pagamentos.some((payment) => payment.id === paymentId)) {
      throw new Error('Pagamento da fábrica não encontrado.');
    }

    const payments = receipt.pagamentos.filter((payment) => payment.id !== paymentId);
    const totalPaid = payments.reduce((sum, payment) => sum + payment.valor, 0);
    const updatedReceipt: FactoryReceipt = {
      ...receipt,
      pagamentos: payments,
      concluido: Math.abs(receipt.valorTotal - totalPaid) < 0.01 ? receipt.concluido : false,
    };
    const receipts = snapshot.recebimentoBaldes.map((item) =>
      item.id === receiptId ? updatedReceipt : item,
    );
    await this.replace(snapshot, receipts);
    return updatedReceipt;
  }

  public async setCompleted(receiptId: string, completed: boolean): Promise<FactoryReceipt> {
    const snapshot = await this.readSnapshot();
    const receipt = snapshot.recebimentoBaldes.find((item) => item.id === receiptId);
    if (!receipt) throw new Error('Recebimento da fábrica não encontrado.');
    const updatedReceipt = { ...receipt, concluido: completed };
    await this.replace(
      snapshot,
      snapshot.recebimentoBaldes.map((item) => (item.id === receiptId ? updatedReceipt : item)),
    );
    return updatedReceipt;
  }

  public async remove(receiptId: string): Promise<void> {
    const snapshot = await this.readSnapshot();
    if (!snapshot.recebimentoBaldes.some((item) => item.id === receiptId)) {
      throw new Error('Recebimento da fábrica não encontrado.');
    }
    await this.replace(
      snapshot,
      snapshot.recebimentoBaldes.filter((item) => item.id !== receiptId),
    );
  }
}

export const createFactoryReceiptMutationService = (uid: string): FactoryReceiptMutationService =>
  new FactoryReceiptMutationService(uid);
