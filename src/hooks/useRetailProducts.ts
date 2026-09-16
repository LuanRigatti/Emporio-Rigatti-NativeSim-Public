import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/providers';
import { retailProductDataSource, type RetailProductQuery } from '@/services/retail-catalog';
import type { RetailProduct, RetailProductDraft, RetailProductPatch } from '@/types/data';

const EMPTY_QUERY: RetailProductQuery = {};

export function useRetailProducts(query: RetailProductQuery = EMPTY_QUERY) {
  const { sessionVersion, status: authStatus, user } = useAuth();
  const [loading, setLoading] = useState(Boolean(user));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const userId = user?.id;
  const getSnapshot = useCallback(
    () => retailProductDataSource.getSnapshot(userId, sessionVersion),
    [sessionVersion, userId],
  );
  const snapshot = useSyncExternalStore(
    retailProductDataSource.subscribe,
    getSnapshot,
    getSnapshot,
  );

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
      else if (!retailProductDataSource.getSnapshot(userId, sessionVersion)) setLoading(true);
      setError(undefined);
      try {
        await retailProductDataSource.load(userId, sessionVersion);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : 'Não foi possível carregar produtos.',
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

  const products = retailProductDataSource.list(query, userId, sessionVersion);
  const create = useCallback(
    (input: RetailProductDraft) => retailProductDataSource.create(userId, input, sessionVersion),
    [sessionVersion, userId],
  );
  const update = useCallback(
    (productId: string, patch: RetailProductPatch) =>
      retailProductDataSource.update(userId, productId, patch, sessionVersion),
    [sessionVersion, userId],
  );
  const remove = useCallback(
    (productId: string) => retailProductDataSource.remove(userId, productId, sessionVersion),
    [sessionVersion, userId],
  );

  return {
    create,
    error,
    loading: loading && snapshot === null,
    products,
    refreshing,
    reload: () => load(true),
    remove,
    snapshot: snapshot as readonly RetailProduct[] | null,
    update,
  };
}
