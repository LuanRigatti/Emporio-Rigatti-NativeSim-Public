import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/providers';
import { retailCostEntryDataSource } from '@/services/retail-costs';
import type { RetailCostEntryDraft } from '@/types/data';

export function useRetailCostEntries(costItemId?: string) {
  const { sessionVersion, status: authStatus, user } = useAuth();
  const userId = user?.id;
  const [loading, setLoading] = useState(Boolean(user && costItemId));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const getSnapshot = useCallback(
    () => retailCostEntryDataSource.getSnapshot(costItemId ?? '', userId, sessionVersion),
    [costItemId, sessionVersion, userId],
  );
  const snapshot = useSyncExternalStore(
    retailCostEntryDataSource.subscribe,
    getSnapshot,
    getSnapshot,
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (!userId || !costItemId) {
        if (authStatus !== 'loading') {
          setLoading(false);
          setRefreshing(false);
          if (!userId) setError('Sessão autenticada indisponível.');
        }
        return;
      }
      if (isRefresh) setRefreshing(true);
      else if (!retailCostEntryDataSource.getSnapshot(costItemId, userId, sessionVersion)) {
        setLoading(true);
      }
      setError(undefined);
      try {
        await retailCostEntryDataSource.load(costItemId, userId, sessionVersion);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar o histórico de custos.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authStatus, costItemId, sessionVersion, userId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const entries = costItemId
    ? retailCostEntryDataSource.list(costItemId, userId, sessionVersion)
    : [];
  const create = useCallback(
    (itemUnit: string, input: RetailCostEntryDraft) =>
      retailCostEntryDataSource.create(userId, costItemId ?? '', itemUnit, input, sessionVersion),
    [costItemId, sessionVersion, userId],
  );
  const updateEffectiveDate = useCallback(
    (entryId: string, effectiveDate: string) =>
      retailCostEntryDataSource.updateEffectiveDate(
        userId,
        costItemId ?? '',
        entryId,
        effectiveDate,
        sessionVersion,
      ),
    [costItemId, sessionVersion, userId],
  );

  return {
    create,
    entries,
    error: snapshot === null ? error : undefined,
    loading: loading && snapshot === null,
    refreshing,
    reload: () => load(true),
    snapshot,
    updateEffectiveDate,
  };
}
