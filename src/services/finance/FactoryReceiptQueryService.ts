import type { FactoryFilters, FactoryReceipt } from '@/types/data';

function currentMonth(today: Date): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

export function compareFactoryReceiptsDescending(
  left: FactoryReceipt,
  right: FactoryReceipt,
): number {
  const dateDiff = right.data.localeCompare(left.data);
  if (dateDiff !== 0) return dateDiff;
  const rightTime = right.createdAt ?? '';
  const leftTime = left.createdAt ?? '';
  if (rightTime !== leftTime) {
    return rightTime.localeCompare(leftTime);
  }
  return right.id.localeCompare(left.id);
}

export class FactoryReceiptQueryService {
  public filter(
    receipts: readonly FactoryReceipt[],
    filters: FactoryFilters,
    today = new Date(),
  ): FactoryReceipt[] {
    const month = filters.month ?? currentMonth(today);
    return receipts
      .filter(
        (receipt) => filters.completed === undefined || receipt.concluido === filters.completed,
      )
      .filter((receipt) => !filters.startDate || receipt.data >= filters.startDate)
      .filter((receipt) => !filters.endDate || receipt.data <= filters.endDate)
      .filter((receipt) => filters.period === 'all' || receipt.data.startsWith(month))
      .sort(compareFactoryReceiptsDescending);
  }
}

export const factoryReceiptQueryService = new FactoryReceiptQueryService();
