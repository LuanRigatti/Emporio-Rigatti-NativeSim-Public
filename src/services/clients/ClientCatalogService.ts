import type { ClientFinancialSummary, ClientModel, CustomClient, Delivery } from '@/types/data';
import type { UserDataSnapshot } from '@/services/data';
import { formatClientName, normalizeClientKey } from '@/utils/data';
import { mapLegacyClientToModel } from '@/mappers/clients';

import { historicalClientNames, resolveClientPrice } from './priceTables';

export interface ClientCatalogQuery {
  search?: string;
  priceDate?: string;
  clientIdForName?: (name: string) => ClientModel['clientId'];
}

function addSource(
  sources: Set<ClientModel['sources'][number]>,
  source: ClientModel['sources'][number],
) {
  sources.add(source);
}

function latestAddress(deliveries: Delivery[], normalizedName: string): string | undefined {
  return [...deliveries]
    .sort((left, right) => right.data.localeCompare(left.data))
    .find(
      (delivery) =>
        normalizeClientKey(delivery.cliente) === normalizedName &&
        Boolean(delivery.endereco?.trim()),
    )?.endereco;
}

function customConfigFor(
  customClients: Record<string, CustomClient>,
  normalizedName: string,
): CustomClient | undefined {
  return Object.entries(customClients).find(
    ([name]) => normalizeClientKey(name) === normalizedName,
  )?.[1];
}

export function summarizeClient(
  deliveries: Delivery[],
  normalizedName: string,
): ClientFinancialSummary {
  const related = deliveries.filter(
    (delivery) => normalizeClientKey(delivery.cliente) === normalizedName,
  );
  const revenue = related.reduce((total, delivery) => total + delivery.valor, 0);
  const paid = related
    .filter((delivery) => delivery.status === 'Pago')
    .reduce((total, delivery) => total + delivery.valor, 0);
  const quantity = related.reduce((total, delivery) => total + delivery.quantidade, 0);

  return {
    deliveryCount: related.length,
    quantity,
    revenue,
    paid,
    pending: revenue - paid,
    balance: revenue - paid,
  };
}

export class ClientCatalogService {
  public list(snapshot: UserDataSnapshot, query: ClientCatalogQuery = {}): ClientModel[] {
    const byKey = new Map<string, { name: string; sources: Set<ClientModel['sources'][number]> }>();
    const add = (name: string, source: ClientModel['sources'][number]) => {
      const canonicalName = formatClientName(name);
      const normalizedName = normalizeClientKey(canonicalName);
      if (!normalizedName) return;
      const existing = byKey.get(normalizedName);
      if (existing) {
        addSource(existing.sources, source);
      } else {
        byKey.set(normalizedName, { name: canonicalName, sources: new Set([source]) });
      }
    };

    historicalClientNames().forEach((name) => add(name, 'historical'));
    Object.keys(snapshot.clientesCustom).forEach((name) => add(name, 'custom'));
    snapshot.entregas.forEach((delivery) => add(delivery.cliente, 'delivery'));

    const normalizedSearch = query.search ? normalizeClientKey(query.search) : '';
    return [...byKey.values()]
      .map(({ name, sources }) => {
        const normalizedName = normalizeClientKey(name);
        const customConfig = customConfigFor(snapshot.clientesCustom, normalizedName);
        const address =
          customConfig?.endereco?.trim() || latestAddress(snapshot.entregas, normalizedName);
        return mapLegacyClientToModel({
          name,
          clientId: query.clientIdForName?.(name),
          sources: [...sources],
          customConfig,
          address,
          currentPrice: resolveClientPrice(name, query.priceDate, snapshot.clientesCustom),
        });
      })
      .filter((client) => !normalizedSearch || client.normalizedName.includes(normalizedSearch))
      .sort((left, right) => left.canonicalName.localeCompare(right.canonicalName, 'pt-BR'));
  }

  public findById(
    snapshot: UserDataSnapshot,
    clientId: ClientModel['clientId'],
  ): ClientModel | undefined {
    return this.list(snapshot).find((client) => client.clientId === clientId);
  }

  public summary(snapshot: UserDataSnapshot, client: ClientModel): ClientFinancialSummary {
    return summarizeClient(snapshot.entregas, client.normalizedName);
  }
}

export const clientCatalogService = new ClientCatalogService();
