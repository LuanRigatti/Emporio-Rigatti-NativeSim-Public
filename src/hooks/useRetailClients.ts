import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/providers';
import { retailClientDataSource, type RetailClientQuery } from '@/services/retail-clients';
import type { RetailClient, RetailClientDraft, RetailClientPatch } from '@/types/data';

const EMPTY_QUERY: RetailClientQuery = {};

export function useRetailClients(query: RetailClientQuery = EMPTY_QUERY) {
  const { sessionVersion, status: authStatus, user } = useAuth();
  const [loading, setLoading] = useState(Boolean(user));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const userId = user?.id;
  const getSnapshot = useCallback(
    () => retailClientDataSource.getSnapshot(userId, sessionVersion),
    [sessionVersion, userId],
  );
  const snapshot = useSyncExternalStore(retailClientDataSource.subscribe, getSnapshot, getSnapshot);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!userId) {
        if (authStatus !== 'loading') {
          setLoading(false);
          setRefreshing(false);
          setError('Sessão autenticada indisponível.');
        }
        return;
      }

      if (isRefresh) setRefreshing(true);
      else if (!retailClientDataSource.getSnapshot(userId, sessionVersion)) setLoading(true);
      setError(undefined);
      try {
        await retailClientDataSource.load(userId, sessionVersion);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar clientes Varejo.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authStatus, sessionVersion, userId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const clients = retailClientDataSource.list(query, userId, sessionVersion);

  const create = useCallback(
    (input: RetailClientDraft) => retailClientDataSource.create(userId, input, sessionVersion),
    [sessionVersion, userId],
  );
  const update = useCallback(
    (clientId: string, patch: RetailClientPatch) =>
      retailClientDataSource.update(userId, clientId, patch, sessionVersion),
    [sessionVersion, userId],
  );
  const remove = useCallback(
    (clientId: string) => retailClientDataSource.remove(userId, clientId, sessionVersion),
    [sessionVersion, userId],
  );

  return {
    clients,
    error,
    loading: loading && snapshot === null,
    refreshing,
    reload: () => load(true),
    create,
    update,
    remove,
    snapshot: snapshot as readonly RetailClient[] | null,
  };
}
