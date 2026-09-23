import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/providers';
import { retailCompositionDataSource } from '@/services/retail-costs';
import type { RetailCompositionVersionDraft } from '@/types/data';
import type { RetailCompositionCostItem } from '@/services/retail-costs';

export function useRetailCompositions(productId?: string) {
  const { sessionVersion, status: authStatus, user } = useAuth();
  const userId = user?.id;
  const [loading, setLoading] = useState(Boolean(user && productId));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const getSnapshot = useCallback(
    () => retailCompositionDataSource.getSnapshot(productId, userId, sessionVersion),
    [productId, sessionVersion, userId],
  );
  const snapshot = useSyncExternalStore(
    retailCompositionDataSource.subscribe,
    getSnapshot,
    getSnapshot,
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (!userId || !productId) {
        if (authStatus !== 'loading') {
          setLoading(false);
          setRefreshing(false);
          if (!userId) setError('Sessão autenticada indisponível.');
        }
        return;
      }
      if (isRefresh) setRefreshing(true);
      else if (!retailCompositionDataSource.getSnapshot(productId, userId, sessionVersion)) {
        setLoading(true);
      }
      setError(undefined);
      try {
        await retailCompositionDataSource.load(productId, userId, sessionVersion);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar as composições.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authStatus, productId, sessionVersion, userId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const versions = productId
    ? retailCompositionDataSource.list(productId, userId, sessionVersion)
    : [];
  const hasSnapshot = snapshot != null;
  const createVersion = useCallback(
    (
      input: RetailCompositionVersionDraft,
      costItems: ReadonlyMap<string, RetailCompositionCostItem>,
    ) =>
      retailCompositionDataSource.createVersion(
        userId,
        productId ?? '',
        input,
        costItems,
        sessionVersion,
      ),
    [productId, sessionVersion, userId],
  );

  return {
    createVersion,
    error,
    loading: loading && !hasSnapshot,
    refreshing,
    reload: () => load(true),
    snapshot,
    versions,
  };
}
