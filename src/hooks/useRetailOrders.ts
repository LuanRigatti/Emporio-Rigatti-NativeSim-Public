import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/providers';
import { retailOrderDataSource, type RetailOrderCatalogContext } from '@/services/retail-orders';
import type { RetailOrderCreateInput, RetailOrderPatch, RetailOrderQuery } from '@/types/data';

const EMPTY_QUERY: RetailOrderQuery = {};

export function useRetailOrders(query: RetailOrderQuery = EMPTY_QUERY) {
  const { sessionVersion, status: authStatus, user } = useAuth();
  const userId = user?.id;
  const [loading, setLoading] = useState(Boolean(user));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const getSnapshot = useCallback(
    () => retailOrderDataSource.getSnapshot(userId, sessionVersion),
    [sessionVersion, userId],
  );
  const snapshot = useSyncExternalStore(retailOrderDataSource.subscribe, getSnapshot, getSnapshot);

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
      else if (!retailOrderDataSource.getSnapshot(userId, sessionVersion)) setLoading(true);
      setError(undefined);
      try {
        await retailOrderDataSource.load(userId, sessionVersion);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar pedidos Varejo.',
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

  const orders = retailOrderDataSource.list(query, userId, sessionVersion);
  const create = useCallback(
    (input: RetailOrderCreateInput, catalog: RetailOrderCatalogContext) =>
      retailOrderDataSource.create(userId, input, catalog, sessionVersion),
    [sessionVersion, userId],
  );
  const update = useCallback(
    (orderId: string, patch: RetailOrderPatch) =>
      retailOrderDataSource.update(userId, orderId, patch, sessionVersion),
    [sessionVersion, userId],
  );
  const complete = useCallback(
    (orderId: string) => retailOrderDataSource.complete(userId, orderId, sessionVersion),
    [sessionVersion, userId],
  );
  const cancel = useCallback(
    (orderId: string) => retailOrderDataSource.cancel(userId, orderId, sessionVersion),
    [sessionVersion, userId],
  );

  return {
    cancel,
    complete,
    create,
    error,
    loading,
    orders,
    refreshing,
    reload: () => load(true),
    snapshot,
    update,
  };
}
