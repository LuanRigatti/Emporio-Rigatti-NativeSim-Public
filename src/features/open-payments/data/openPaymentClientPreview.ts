import type { ClientId, Delivery } from '@/types/data';
import { formatClientName, normalizeClientKey } from '@/utils/data';

const MAX_RECENT_PAYMENTS = 3;

type ClientOpenDeliveries = {
  nome: string;
  deliveries: readonly Delivery[];
};

export function getRecentPaidDeliveriesForClient(
  client: ClientOpenDeliveries,
  paidDeliveries: readonly Delivery[],
): Delivery[] {
  const clientIds = new Set(
    client.deliveries
      .map((delivery) => delivery.clientId)
      .filter((clientId): clientId is ClientId => Boolean(clientId)),
  );
  const normalizedClientName = normalizeClientKey(formatClientName(client.nome));

  return paidDeliveries
    .filter((delivery) => {
      if (delivery.status !== 'Pago') return false;
      if (delivery.clientId && clientIds.size > 0) return clientIds.has(delivery.clientId);

      return normalizeClientKey(formatClientName(delivery.cliente)) === normalizedClientName;
    })
    .sort(
      (left, right) =>
        right.data.localeCompare(left.data) || (right.createdAt ?? 0) - (left.createdAt ?? 0),
    )
    .slice(0, MAX_RECENT_PAYMENTS);
}
