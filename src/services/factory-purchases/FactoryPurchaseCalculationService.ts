import type { Purchase } from '@/features/factory-purchases/types';
import { normalizeMoney } from '@/utils/data';

export type FactoryPurchaseSummary = {
  totalPaid: number;
  openValue: number;
  totalBuckets: number;
};

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

export function comparePurchasesDescending(left: Purchase, right: Purchase): number {
  const dateDiff = right.date.localeCompare(left.date);
  if (dateDiff !== 0) return dateDiff;
  const rightTime = right.createdAt ?? '';
  const leftTime = left.createdAt ?? '';
  if (rightTime !== leftTime) {
    return rightTime.localeCompare(leftTime);
  }
  return right.id.localeCompare(left.id);
}

export class FactoryPurchaseCalculationService {
  public filterByPeriod(purchases: readonly Purchase[], year: number, month: number): Purchase[] {
    const monthKey = `${year}-${String(month).padStart(2, '0')}-`;
    return purchases
      .filter((purchase) => purchase.date.startsWith(monthKey))
      .sort(comparePurchasesDescending);
  }

  public paidAmount(purchase: Purchase): number {
    return roundMoney(
      purchase.payments.reduce((total, payment) => total + Math.max(0, payment.amount), 0),
    );
  }

  public remainingAmount(purchase: Purchase): number {
    return Math.max(0, roundMoney(purchase.totalAmount - this.paidAmount(purchase)));
  }

  public isPaid(purchase: Purchase): boolean {
    return this.remainingAmount(purchase) <= 0.01;
  }

  public assertPaymentWithinBalance(purchase: Purchase, amount: number): number {
    const normalizedAmount = normalizeMoney(amount);
    if (normalizedAmount === undefined || normalizedAmount <= 0) {
      throw new Error('Informe um valor de pagamento maior que zero.');
    }

    const remaining = this.remainingAmount(purchase);
    if (normalizedAmount > remaining + 0.01) {
      throw new Error('O pagamento não pode ser maior que o saldo restante.');
    }

    return roundMoney(normalizedAmount);
  }

  public summarize(purchases: readonly Purchase[]): FactoryPurchaseSummary {
    return purchases.reduce<FactoryPurchaseSummary>(
      (summary, purchase) => ({
        totalPaid: roundMoney(summary.totalPaid + this.paidAmount(purchase)),
        openValue: roundMoney(summary.openValue + this.remainingAmount(purchase)),
        totalBuckets: summary.totalBuckets + Math.max(0, purchase.bucketQuantity),
      }),
      { openValue: 0, totalBuckets: 0, totalPaid: 0 },
    );
  }
}

export const factoryPurchaseCalculationService = new FactoryPurchaseCalculationService();
