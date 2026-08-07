import type { CustomClient } from '@/types/data';
import { normalizeMoney } from '@/utils/data';
import { resolveClientPrice } from '@/services/clients/priceTables';

export interface DeliveryPriceInput {
  clientName: string;
  date: string;
  quantity: number | string;
  customClients: Record<string, CustomClient>;
  fallbackValue?: number | string;
}

export class DeliveryPricingService {
  public resolveUnitPrice(input: DeliveryPriceInput): number | undefined {
    const price = resolveClientPrice(input.clientName, input.date, input.customClients);
    return price === undefined ? undefined : Number(price.toFixed(2));
  }

  public calculateAutomaticValue(input: DeliveryPriceInput): number {
    const quantity = normalizeMoney(input.quantity) ?? 0;
    const price = this.resolveUnitPrice(input);
    if (price !== undefined && quantity > 0) {
      return Number((price * quantity).toFixed(2));
    }
    return normalizeMoney(input.fallbackValue) ?? 0;
  }
}

export const deliveryPricingService = new DeliveryPricingService();
