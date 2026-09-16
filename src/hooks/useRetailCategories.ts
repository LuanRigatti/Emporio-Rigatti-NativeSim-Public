import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/providers';
import { retailCategoryDataSource, type RetailCategoryQuery } from '@/services/retail-catalog';
import type { RetailCategory, RetailCategoryDraft, RetailCategoryPatch } from '@/types/data';

const EMPTY_QUERY: RetailCategoryQuery = {};

export function useRetailCategories(query: RetailCategoryQuery = EMPTY_QUERY) {
  const { sessionVersion, status: authStatus, user } = useAuth();
  const [loading, setLoading] = useState(Boolean(user));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const userId = user?.id;
  const getSnapshot = useCallback(
    () => retailCategoryDataSource.getSnapshot(userId, sessionVersion),
    [sessionVersion, userId],
  );
  const snapshot = useSyncExternalStore(
    retailCategoryDataSource.subscribe,
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
      else if (!retailCategoryDataSource.getSnapshot(userId, sessionVersion)) setLoading(true);
      setError(undefined);
      try {
        await retailCategoryDataSource.load(userId, sessionVersion);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : 'Não foi possível carregar categorias.',
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

  const categories = retailCategoryDataSource.list(query, userId, sessionVersion);
  const create = useCallback(
    (input: RetailCategoryDraft) => retailCategoryDataSource.create(userId, input, sessionVersion),
    [sessionVersion, userId],
  );
  const update = useCallback(
    (categoryId: string, patch: RetailCategoryPatch) =>
      retailCategoryDataSource.update(userId, categoryId, patch, sessionVersion),
    [sessionVersion, userId],
  );
  const remove = useCallback(
    (categoryId: string) => retailCategoryDataSource.remove(userId, categoryId, sessionVersion),
    [sessionVersion, userId],
  );
  const ensureInitialCategories = useCallback(
    () => retailCategoryDataSource.ensureInitialCategories(userId, sessionVersion),
    [sessionVersion, userId],
  );

  return {
    categories,
    create,
    ensureInitialCategories,
    error,
    loading: loading && snapshot === null,
    refreshing,
    reload: () => load(true),
    remove,
    snapshot: snapshot as readonly RetailCategory[] | null,
    update,
  };
}
