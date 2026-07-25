import type { ClientModel, Delivery } from '@/types/data';
import type { UserDataSnapshot } from '@/services/data';
import { normalizeClientKey } from '@/utils/data';

export interface ClientImpact {
  clientName: string;
  deliveryCount: number;
  paidDeliveryCount: number;
  pendingDeliveryCount: number;
  relatedPaymentCount: number;
  relatedHistoryCount: number;
  quantity: number;
  revenue: number;
}

function relatedDeliveries(deliveries: Delivery[], normalizedName: string): Delivery[] {
  return deliveries.filter((delivery) => normalizeClientKey(delivery.cliente) === normalizedName);
}

export function calculateClientImpact(
  snapshot: UserDataSnapshot,
  client: ClientModel,
): ClientImpact {
  const deliveries = relatedDeliveries(snapshot.entregas, client.normalizedName);
  const paidDeliveryCount = deliveries.filter((delivery) => delivery.status === 'Pago').length;

  return {
    clientName: client.canonicalName,
    deliveryCount: deliveries.length,
    paidDeliveryCount,
    pendingDeliveryCount: deliveries.length - paidDeliveryCount,
    relatedPaymentCount: paidDeliveryCount,
    relatedHistoryCount: deliveries.length,
    quantity: deliveries.reduce((total, delivery) => total + delivery.quantidade, 0),
    revenue: deliveries.reduce((total, delivery) => total + delivery.valor, 0),
  };
}
