import type { FactoryFilters, FactoryReceipt } from '@/types/data';

function currentMonth(today: Date): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

export class FactoryReceiptQueryService {
  public filter(
    receipts: readonly FactoryReceipt[],
    filters: FactoryFilters,
    today = new Date(),
  ): FactoryReceipt[] {
    const month = filters.month ?? currentMonth(today);
    return receipts
      .filter((receipt) => filters.period === 'all' || receipt.data.startsWith(month))
      .sort((left, right) => right.data.localeCompare(left.data));
  }
}

export const factoryReceiptQueryService = new FactoryReceiptQueryService();
