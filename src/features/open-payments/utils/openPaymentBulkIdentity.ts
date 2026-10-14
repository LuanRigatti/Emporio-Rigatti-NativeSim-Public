import type { Delivery } from '@/types/data';

export function getUnambiguousCanonicalClientId(deliveries: readonly Delivery[]): string | null {
  if (deliveries.length === 0) return null;

  let canonicalClientId: string | null = null;
  for (const delivery of deliveries) {
    const clientId = delivery.clientId;
    if (
      typeof clientId !== 'string' ||
      !clientId.startsWith('client:') ||
      clientId.length <= 'client:'.length ||
      clientId.slice('client:'.length).includes('/')
    ) {
      return null;
    }
    if (canonicalClientId !== null && canonicalClientId !== clientId) return null;
    canonicalClientId = clientId;
  }

  return canonicalClientId;
}
