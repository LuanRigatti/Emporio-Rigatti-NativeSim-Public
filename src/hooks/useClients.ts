import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { ENABLE_MOCK_CLIENT_DATA } from '@/config/featureFlags';
import { useAuth } from '@/providers';
import {
  clientCatalogService,
  clientIdentityRegistry,
  mockClientDataSource,
  type ClientCatalogQuery,
} from '@/services/clients';
import { ClientMutationService } from '@/services/clients/ClientMutationService';
import { userDataService } from '@/services/data';
import type { UserDataSnapshot } from '@/services/data';
import type { ClientModel } from '@/types/data';

export function useClients(query: ClientCatalogQuery = {}) {
  const { error: authError, status: authStatus, user } = useAuth();
  const [firebaseSnapshot, setFirebaseSnapshot] = useState<UserDataSnapshot | null>(null);
  const [loading, setLoading] = useState(!ENABLE_MOCK_CLIENT_DATA);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const mockSnapshot = useSyncExternalStore(
    mockClientDataSource.subscribe,
    mockClientDataSource.getSnapshot,
    mockClientDataSource.getSnapshot,
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (ENABLE_MOCK_CLIENT_DATA) {
        setLoading(false);
        setRefreshing(false);
        setError(undefined);
        return;
      }
      if (!user) {
        if (authStatus === 'loading') return;
        setLoading(false);
        setRefreshing(false);
        setError(authError ?? 'Sess\u00e3o autenticada indispon\u00edvel.');
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(undefined);
      try {
        await clientIdentityRegistry.load(user.id);
        const result = await userDataService.loadWithCacheFallback(user.id);
        setFirebaseSnapshot(result.snapshot);
      } catch (loadError) {
        if (__DEV__) {
          console.error('[useClients] Falha ao carregar clientes.', loadError);
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'N\u00e3o foi poss\u00edvel carregar clientes.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authError, authStatus, user],
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const snapshot = ENABLE_MOCK_CLIENT_DATA ? mockSnapshot : firebaseSnapshot;
  const clients = useMemo<ClientModel[]>(
    () =>
      ENABLE_MOCK_CLIENT_DATA
        ? mockClientDataSource.list(query)
        : snapshot && user
          ? clientCatalogService.list(snapshot, {
              ...query,
              clientIdForName: (name) => clientIdentityRegistry.get(user.id, name),
            })
          : [],
    [query, snapshot, user],
  );

  const mutate = useCallback(
    async (operation: (service: ClientMutationService) => Promise<void>) => {
      if (!user) throw new Error('Sess\u00e3o n\u00e3o dispon\u00edvel.');
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
      ENABLE_MOCK_CLIENT_DATA
        ? mockClientDataSource.rename(client, newName)
        : mutate((service) => service.rename(client, newName).then(() => undefined)),
    removeCustomConfiguration: (client: ClientModel) =>
      ENABLE_MOCK_CLIENT_DATA
        ? mockClientDataSource.removeCustomConfiguration(client)
        : mutate((service) => service.removeCustomConfiguration(client).then(() => undefined)),
    saveCustomClient: (name: string, price: number, address: string) =>
      ENABLE_MOCK_CLIENT_DATA
        ? mockClientDataSource.saveCustomClient(name, price, address)
        : mutate((service) => service.saveCustomClient(name, price, address)),
  };
}
