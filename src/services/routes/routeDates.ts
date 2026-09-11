import type { Delivery } from '@/types/data';
import { normalizeLegacyDate } from '@/utils/data';

export function getAvailableRouteDates(deliveries: readonly Pick<Delivery, 'data'>[]): string[] {
  return Array.from(
    new Set(
      deliveries
        .map((delivery) => normalizeLegacyDate(delivery.data))
        .filter((date): date is string => Boolean(date)),
    ),
  ).sort((left, right) => right.localeCompare(left));
}
