import type { Delivery, DeliveryFilters } from '@/types/data';
import { formatClientName, normalizeClientKey, todayIso } from '@/utils/data';

export class DeliveryQueryService {
  public filter(deliveries: Delivery[], filters: DeliveryFilters): Delivery[] {
    const date = filters.date ?? todayIso();
    const search = filters.search ? normalizeClientKey(filters.search) : '';
    const clientName = filters.clientName ? normalizeClientKey(filters.clientName) : '';

    return deliveries
      .filter((delivery) => filters.mode === 'all' || delivery.data === date)
      .filter((delivery) => !filters.startDate || delivery.data >= filters.startDate)
      .filter((delivery) => !filters.endDate || delivery.data <= filters.endDate)
      .filter(
        (delivery) =>
          !search || normalizeClientKey(formatClientName(delivery.cliente)).includes(search),
      )
      .filter((delivery) => !clientName || normalizeClientKey(delivery.cliente) === clientName)
      .filter(
        (delivery) =>
          !filters.status || filters.status === 'Todos' || delivery.status === filters.status,
      )
      .filter(
        (delivery) =>
          !filters.deliveryStatus ||
          filters.deliveryStatus === 'Todos' ||
          (filters.deliveryStatus === 'Entregue' ? delivery.entregue : !delivery.entregue),
      )
      .filter(
        (delivery) =>
          !filters.invoiceStatus ||
          filters.invoiceStatus === 'Todos' ||
          (delivery.invoiceStatus ?? 'a_emitir') === filters.invoiceStatus,
      )
      .filter(
        (delivery) =>
          !filters.boletoStatus ||
          filters.boletoStatus === 'Todos' ||
          (delivery.boletoStatus ?? delivery.invoiceStatus ?? 'a_emitir') === filters.boletoStatus,
      )
      .sort(
        (left, right) =>
          right.data.localeCompare(left.data) ||
          formatClientName(left.cliente).localeCompare(formatClientName(right.cliente), 'pt-BR'),
      );
  }
}

export const deliveryQueryService = new DeliveryQueryService();
