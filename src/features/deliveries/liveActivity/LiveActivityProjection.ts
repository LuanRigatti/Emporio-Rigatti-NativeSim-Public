import { financialCalculationService } from '@/services/finance/FinancialCalculationService';
import type { CompleteDeliveryDateSnapshot } from '@/services/deliveries/FirestoreDeliveryDataSource';

export type LiveActivityProjection = {
  date: string;
  bucketCount: number;
  deliveryCount: number;
};

export function projectWholesaleDeliverySnapshot(
  snapshot: CompleteDeliveryDateSnapshot,
): LiveActivityProjection {
  return {
    date: snapshot.date,
    bucketCount: financialCalculationService.calculateQuantidade([...snapshot.deliveries]),
    deliveryCount: snapshot.deliveries.length,
  };
}

export function nextLocalMidnight(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day + 1);
}
