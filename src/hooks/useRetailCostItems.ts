import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/providers';
import { retailCostItemDataSource, type RetailCostItemQuery } from '@/services/retail-costs';
import type { RetailCostItem, RetailCostItemDraft, RetailCostItemPatch } from '@/types/data';

const EMPTY_QUERY: RetailCostItemQuery = {};

export function useRetailCostItems(query: RetailCostItemQuery = EMPTY_QUERY) {
  const { sessionVersion, status: authStatus, user } = useAuth();
  const userId = user?.id;
  const [loading, setLoading] = useState(Boolean(user));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const getSnapshot = useCallback(
    () => retailCostItemDataSource.getSnapshot(userId, sessionVersion),
    [sessionVersion, userId],
  );
  const snapshot = useSyncExternalStore(
    retailCostItemDataSource.subscribe,
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
      else if (!retailCostItemDataSource.getSnapshot(userId, sessionVersion)) setLoading(true);
      setError(undefined);
      try {
        await retailCostItemDataSource.load(userId, sessionVersion);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar itens de custo.',
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

  const items = retailCostItemDataSource.list(query, userId, sessionVersion);
  const create = useCallback(
    (input: RetailCostItemDraft) => retailCostItemDataSource.create(userId, input, sessionVersion),
    [sessionVersion, userId],
  );
  const update = useCallback(
    (costItemId: string, patch: RetailCostItemPatch) =>
      retailCostItemDataSource.update(userId, costItemId, patch, sessionVersion),
    [sessionVersion, userId],
  );
  const remove = useCallback(
    (costItemId: string) => retailCostItemDataSource.remove(userId, costItemId, sessionVersion),
    [sessionVersion, userId],
  );

  return {
    create,
    error,
    items,
    loading: loading && snapshot === null,
    refreshing,
    reload: () => load(true),
    remove,
    snapshot: snapshot as readonly RetailCostItem[] | null,
    update,
  };
}
