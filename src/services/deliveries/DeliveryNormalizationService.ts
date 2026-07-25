import type { Delivery } from '@/types/data';
import { formatClientName, normalizeLegacyDate } from '@/utils/data';

export interface DeliveryNormalizationResult {
  deliveries: Delivery[];
  changed: boolean;
}

export class DeliveryNormalizationService {
  public normalize(deliveries: Delivery[], today: string): DeliveryNormalizationResult {
    let changed = false;
    const normalized = deliveries.map((delivery) => {
      const clientName = formatClientName(delivery.cliente);
      const date = normalizeLegacyDate(delivery.data) ?? delivery.data;
      const delivered = date < today && delivery.entregue === false ? true : delivery.entregue;
      if (
        clientName !== delivery.cliente ||
        date !== delivery.data ||
        delivered !== delivery.entregue
      ) {
        changed = true;
      }
      return { ...delivery, cliente: clientName, data: date, entregue: delivered };
    });
    return { deliveries: normalized, changed };
  }
}

export const deliveryNormalizationService = new DeliveryNormalizationService();
