import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/providers';
import {
  clientCatalogService,
  clientIdentityRegistry,
  type ClientCatalogQuery,
} from '@/services/clients';
import { ClientMutationService } from '@/services/clients/ClientMutationService';
import { userDataService } from '@/services/data';
import type { UserDataSnapshot } from '@/services/data';
import type { ClientModel } from '@/types/data';

export function useClients(query: ClientCatalogQuery = {}) {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<UserDataSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(undefined);
      try {
        await clientIdentityRegistry.load(user.id);
        const result = await userDataService.loadWithCacheFallback(user.id);
        setSnapshot(result.snapshot);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : 'Não foi possível carregar clientes.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user],
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const clients = useMemo<ClientModel[]>(
    () =>
      snapshot && user
        ? clientCatalogService.list(snapshot, {
            ...query,
            clientIdForName: (name) => clientIdentityRegistry.get(user.id, name),
          })
        : [],
    [query, snapshot, user],
  );

  const mutate = useCallback(
    async (operation: (service: ClientMutationService) => Promise<void>) => {
      if (!user) throw new Error('Sessão não disponível.');
      const service = new ClientMutationService(user.id);
      await operation(service);
      await load(true);
    },
    [load, user],
  );

  return {
    clients,
    snapshot,
    loading,
    refreshing,
    error,
    reload: () => load(true),
    rename: (client: ClientModel, newName: string) =>
      mutate((service) => service.rename(client, newName).then(() => undefined)),
    removeCustomConfiguration: (client: ClientModel) =>
      mutate((service) => service.removeCustomConfiguration(client).then(() => undefined)),
    saveCustomClient: (name: string, price: number, address: string) =>
      mutate((service) => service.saveCustomClient(name, price, address)),
  };
}
