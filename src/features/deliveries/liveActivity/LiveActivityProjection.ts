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
  const pendingDeliveries = snapshot.deliveries.filter((delivery) => !delivery.entregue);
  return {
    date: snapshot.date,
    bucketCount: financialCalculationService.calculateQuantidade([...pendingDeliveries]),
    deliveryCount: pendingDeliveries.length,
  };
}

export function nextLocalMidnight(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day + 1);
}
