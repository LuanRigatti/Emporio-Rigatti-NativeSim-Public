import type { ClientModel, ClientSource, CustomClient } from '@/types/data';
import { clientIdFromName, formatClientName, normalizeClientKey } from '@/utils/data';

export interface LegacyClientModelInput {
  name: string;
  clientId?: ClientModel['clientId'];
  sources: ClientSource[];
  customConfig?: CustomClient;
  address?: string;
  currentPrice?: number;
}

export function mapLegacyClientToModel(input: LegacyClientModelInput): ClientModel {
  const canonicalName = formatClientName(input.name);
  return {
    clientId: input.clientId ?? clientIdFromName(canonicalName),
    canonicalName,
    normalizedName: normalizeClientKey(canonicalName),
    sources: input.sources,
    customConfig: input.customConfig,
    address: input.address,
    hasIncompleteAddress: !input.address,
    currentPrice: input.currentPrice,
    usesInvoice: input.customConfig?.usesInvoice === true,
  };
}

export function mapClientModelToLegacyName(client: Pick<ClientModel, 'canonicalName'>): string {
  return client.canonicalName;
}
