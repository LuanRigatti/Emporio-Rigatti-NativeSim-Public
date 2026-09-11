import type { FactoryReceipt } from '@/types/data';
import { expenseCalculationService } from '@/services/expenses/ExpenseCalculationService';
import { normalizeMoney } from '@/utils/data';

export interface FactorySummary {
  totalReceipts: number;
  totalBuckets: number;
  totalValue: number;
  totalPaid: number;
  openValue: number;
}

export type FactorySettlementStatus = 'paid' | 'partial' | 'open';

export const FACTORY_PAYMENT_TOLERANCE = 0.01;

function safeNumber(value: unknown): number {
  return normalizeMoney(value) ?? 0;
}

export class FactoryCalculationService {
  public totalPaid(receipt: FactoryReceipt): number {
    return receipt.pagamentos.reduce((total, payment) => total + safeNumber(payment.valor), 0);
  }

  public openValue(receipt: FactoryReceipt): number {
    return Math.max(0, safeNumber(receipt.valorTotal) - this.totalPaid(receipt));
  }

  public paymentProgress(receipt: FactoryReceipt): number {
    return this.paymentProgressForValues(this.totalPaid(receipt), receipt.valorTotal);
  }

  public paymentProgressForValues(totalPaid: number, totalValue: number): number {
    const total = safeNumber(totalValue);
    return total > 0 ? Math.min(1, safeNumber(totalPaid) / total) : 0;
  }

  public calculateReceiptTotal(quantity: number, date: string): number {
    return Number(
      (Math.max(0, quantity) * expenseCalculationService.calculateBucketCost(date)).toFixed(2),
    );
  }

  public isWithinSettlementTolerance(receipt: FactoryReceipt): boolean {
    return (
      Math.abs(safeNumber(receipt.valorTotal) - this.totalPaid(receipt)) < FACTORY_PAYMENT_TOLERANCE
    );
  }

  public settlementStatus(receipt: FactoryReceipt): FactorySettlementStatus {
    if (this.isWithinSettlementTolerance(receipt)) return 'paid';
    return this.totalPaid(receipt) > 0 ? 'partial' : 'open';
  }

  public assertPaymentWithinBalance(receipt: FactoryReceipt, amount: number): number {
    const payment = normalizeMoney(amount);
    if (payment === undefined || payment <= 0) {
      throw new Error('Informe um valor de pagamento maior que zero.');
    }

    const remaining = this.openValue(receipt);
    if (remaining <= 0 || this.isWithinSettlementTolerance(receipt)) {
      throw new Error('Este recebimento já está quitado.');
    }

    const roundedPayment = Number(payment.toFixed(2));
    const roundedRemaining = Number(remaining.toFixed(2));
    if (roundedPayment > roundedRemaining) {
      throw new Error(
        `O pagamento não pode ultrapassar o saldo restante de R$ ${roundedRemaining.toFixed(2).replace('.', ',')}.`,
      );
    }

    return roundedPayment;
  }

  public summarize(receipts: FactoryReceipt[]): FactorySummary {
    return receipts.reduce<FactorySummary>(
      (summary, receipt) => ({
        totalReceipts: summary.totalReceipts + 1,
        totalBuckets: summary.totalBuckets + safeNumber(receipt.quantidade),
        totalValue: summary.totalValue + safeNumber(receipt.valorTotal),
        totalPaid: summary.totalPaid + this.totalPaid(receipt),
        openValue: summary.openValue + this.openValue(receipt),
      }),
      { totalReceipts: 0, totalBuckets: 0, totalValue: 0, totalPaid: 0, openValue: 0 },
    );
  }
}

export const factoryCalculationService = new FactoryCalculationService();
