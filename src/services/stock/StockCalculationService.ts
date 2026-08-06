import type { Delivery } from '@/types/data';
import { normalizeLegacyDate } from '@/utils/data';

function periodPrefix(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-`;
}

function matchesPeriod(date: string, year: number, month: number): boolean {
  return (normalizeLegacyDate(date) ?? date).startsWith(periodPrefix(year, month));
}

export class StockCalculationService {
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
