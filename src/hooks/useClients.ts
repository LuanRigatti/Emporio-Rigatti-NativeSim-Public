import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/providers';
import { clientDataSource, type ClientCatalogQuery } from '@/services/clients';
import type { UserDataSnapshot } from '@/services/data';
import type { ClientModel } from '@/types/data';

const EMPTY_CLIENT_QUERY: ClientCatalogQuery = {};

export function useClients(query: ClientCatalogQuery = EMPTY_CLIENT_QUERY) {
  const { sessionVersion, status: authStatus, user } = useAuth();
  const [loading, setLoading] = useState(
    clientDataSource.mode === 'firebase' &&
      clientDataSource.getSnapshot(user?.id, sessionVersion) === null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const getSnapshot = useCallback(
    () => clientDataSource.getSnapshot(user?.id, sessionVersion),
    [sessionVersion, user?.id],
  );
  const snapshot = useSyncExternalStore(clientDataSource.subscribe, getSnapshot, getSnapshot);

  const load = useCallback(
    async (isRefresh = false) => {
      if (clientDataSource.mode === 'firebase' && !user) {
        if (authStatus === 'loading') return;
        setLoading(false);
        setRefreshing(false);
        setError('Sessão autenticada indisponível.');
        return;
      }

      if (isRefresh) setRefreshing(true);
      else if (clientDataSource.getSnapshot(user?.id, sessionVersion) === null) setLoading(true);
      setError(undefined);
      try {
        await clientDataSource.load(user?.id);
      } catch (loadError) {
        if (__DEV__) {
          console.error('[useClients] Falha ao carregar clientes.', loadError);
        }
        const usingLocalFallback =
          'isUsingLocalFallback' in clientDataSource && clientDataSource.isUsingLocalFallback;
        if (!usingLocalFallback) {
          setError(
            loadError instanceof Error ? loadError.message : 'Não foi possível carregar clientes.',
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authStatus, sessionVersion, user],
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const { clientIdForName, includeHistorical, priceDate, search } = query;
  const clients = useMemo(() => {
    if (clientDataSource.mode === 'firebase' && !snapshot) return [];
    return clientDataSource.list(
      { clientIdForName, includeHistorical, priceDate, search },
      user?.id,
      sessionVersion,
    );
  }, [clientIdForName, includeHistorical, priceDate, search, sessionVersion, snapshot, user?.id]);

  const mutate = useCallback(
    async (operation: () => Promise<void>) => {
      await operation();
      await load(true);
    },
    [load],
  );
  const reload = useCallback(() => load(true), [load]);

  return {
    clients,
    snapshot: snapshot as UserDataSnapshot | null,
    loading,
    refreshing,
    error,
    reload,
    rename: (client: ClientModel, newName: string) =>
      mutate(() => clientDataSource.rename(user?.id, client, newName)),
    removeCustomConfiguration: (client: ClientModel) =>
      mutate(() => clientDataSource.removeCustomConfiguration(user?.id, client)),
    saveCustomClient: (
      name: string,
      price: number,
      address: string,
      usesInvoice?: boolean,
      usesBoleto?: boolean,
    ) =>
      mutate(() =>
        clientDataSource.saveCustomClient(user?.id, name, price, address, usesInvoice, usesBoleto),
      ),
    updatePrice: (
      client: ClientModel,
      price: number,
      usesInvoice?: boolean,
      usesBoleto?: boolean,
    ) =>
      mutate(() => clientDataSource.updatePrice(user?.id, client, price, usesInvoice, usesBoleto)),
  };
}
