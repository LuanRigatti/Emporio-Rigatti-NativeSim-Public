import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/providers';
import { userDataService } from '@/services/data';
import type { UserDataSnapshot } from '@/services/data';

export function useFinancialData() {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<UserDataSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user) {
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(undefined);

      try {
        const result = await userDataService.loadWithCacheFallback(user.id);
        setSnapshot(result.snapshot);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar os dados financeiros.',
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

  return {
    snapshot,
    loading,
    refreshing,
    error,
    reload: () => load(true),
  };
}

export type UseFinancialDataResult = ReturnType<typeof useFinancialData>;
