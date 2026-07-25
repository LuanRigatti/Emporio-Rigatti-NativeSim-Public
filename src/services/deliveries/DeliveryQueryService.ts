import type { Delivery, DeliveryFilters } from '@/types/data';
import { formatClientName, normalizeClientKey } from '@/utils/data';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export class DeliveryQueryService {
  public filter(deliveries: Delivery[], filters: DeliveryFilters): Delivery[] {
    const date = filters.date ?? todayIso();
    const search = filters.search ? normalizeClientKey(filters.search) : '';
    const clientName = filters.clientName ? normalizeClientKey(filters.clientName) : '';

    return deliveries
      .filter((delivery) => filters.mode === 'all' || delivery.data === date)
      .filter(
        (delivery) =>
          !search || normalizeClientKey(formatClientName(delivery.cliente)).includes(search),
      )
      .filter((delivery) => !clientName || normalizeClientKey(delivery.cliente) === clientName)
      .filter(
        (delivery) =>
          !filters.status || filters.status === 'Todos' || delivery.status === filters.status,
      )
      .sort(
        (left, right) =>
          right.data.localeCompare(left.data) ||
          formatClientName(left.cliente).localeCompare(formatClientName(right.cliente), 'pt-BR'),
      );
  }
}

export const deliveryQueryService = new DeliveryQueryService();
