import type { Delivery, FactoryReceipt, StockSnapshot } from '@/types/data';
import { normalizeLegacyDate } from '@/utils/data';

function periodPrefix(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-`;
}

function matchesPeriod(date: string, year: number, month: number): boolean {
  return (normalizeLegacyDate(date) ?? date).startsWith(periodPrefix(year, month));
}

export type StockCalculationInput = {
  deliveries: readonly Delivery[];
  month: number;
  receipts: readonly FactoryReceipt[];
  year: number;
};

export type StockPeriodSummary = {
  deliveredBuckets: number;
  endingBuckets: number;
  openingBuckets: number;
  purchasedBuckets: number;
};

function normalizedDate(date: string): string | undefined {
  const normalized = normalizeLegacyDate(date);
  if (normalized) return normalized;
  return /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : undefined;
}

function periodStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function nextPeriodStart(year: number, month: number): string {
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return periodStart(nextYear, nextMonth);
}

function isBefore(date: string | undefined, boundary: string): boolean {
  return date !== undefined && date < boundary;
}

function isInPeriod(date: string | undefined, year: number, month: number): boolean {
  const start = periodStart(year, month);
  const end = nextPeriodStart(year, month);
  return date !== undefined && date >= start && date < end;
}

export class StockCalculationService {
  public calculate({
    deliveries,
    month,
    receipts,
    year,
  }: StockCalculationInput): StockPeriodSummary {
    const start = periodStart(year, month);
    const normalizedReceipts = receipts.map((receipt) => ({
      date: normalizedDate(receipt.data),
      quantity: Math.max(0, receipt.quantidade),
    }));
    const normalizedDeliveries = deliveries.map((delivery) => ({
      date: normalizedDate(delivery.data),
      quantity: Math.max(0, delivery.quantidade),
    }));
    const openingBuckets =
      normalizedReceipts
        .filter((receipt) => isBefore(receipt.date, start))
        .reduce((total, receipt) => total + receipt.quantity, 0) -
      normalizedDeliveries
        .filter((delivery) => isBefore(delivery.date, start))
        .reduce((total, delivery) => total + delivery.quantity, 0);
    const purchasedBuckets = normalizedReceipts
      .filter((receipt) => isInPeriod(receipt.date, year, month))
      .reduce((total, receipt) => total + receipt.quantity, 0);
    const deliveredBuckets = normalizedDeliveries
      .filter((delivery) => isInPeriod(delivery.date, year, month))
      .reduce((total, delivery) => total + delivery.quantity, 0);

    return {
      deliveredBuckets,
      endingBuckets: openingBuckets + purchasedBuckets - deliveredBuckets,
      openingBuckets,
      purchasedBuckets,
    };
  }

  public createSnapshot(
    period: string,
    summary: StockPeriodSummary,
    calculatedAt = new Date().toISOString(),
  ): StockSnapshot {
    return {
      calculatedAt,
      closingBalance: summary.endingBuckets,
      delivered: summary.deliveredBuckets,
      openingBalance: summary.openingBuckets,
      period,
      purchased: summary.purchasedBuckets,
    };
  }

  public calculateSoldBuckets(
    deliveries: readonly Delivery[],
    year: number,
    month: number,
  ): number {
    return deliveries.reduce(
      (total, delivery) =>
        matchesPeriod(delivery.data, year, month)
          ? total + Math.max(0, delivery.quantidade)
          : total,
      0,
    );
  }

  public calculateCurrentBuckets(stockBuckets: number, soldBuckets: number): number {
    return stockBuckets - soldBuckets;
  }

  public calculateStockValue(currentBuckets: number, bucketCost: number): number {
    return currentBuckets * bucketCost;
  }
}

export const stockCalculationService = new StockCalculationService();
