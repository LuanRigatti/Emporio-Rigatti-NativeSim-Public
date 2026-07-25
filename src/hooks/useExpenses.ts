import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/providers';
import { userDataService } from '@/services/data';
import type { UserDataSnapshot } from '@/services/data';
import { createExpenseMutationService, expenseQueryService } from '@/services/expenses';
import type { DailyExpenseDraft, ExpenseFilters, MonthlyLightDraft } from '@/types/data';

export function useExpenses(filters: ExpenseFilters = { period: 'day' }) {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<UserDataSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(undefined);
      try {
        const result = await userDataService.loadWithCacheFallback(user.id);
        setSnapshot(result.snapshot);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : 'Não foi possível carregar os gastos.',
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

  const summary = useMemo(
    () =>
      snapshot
        ? expenseQueryService.summarize(
            filters,
            snapshot.gastosDiarios,
            snapshot.gastosMensais,
            snapshot.entregas,
          )
        : undefined,
    [filters, snapshot],
  );

  const mutate = useCallback(
    async (
      operation: ReturnType<typeof createExpenseMutationService> extends infer T
        ? (service: T) => Promise<unknown>
        : never,
    ) => {
      if (!user) throw new Error('Sessão não disponível.');
      await operation(createExpenseMutationService(user.id));
      await load(true);
    },
    [load, user],
  );

  return {
    snapshot,
    summary,
    loading,
    refreshing,
    error,
    reload: () => load(true),
    saveDailyExpense: (draft: DailyExpenseDraft) =>
      mutate((service) => service.saveDailyExpense(draft)),
    saveMonthlyLight: (draft: MonthlyLightDraft) =>
      mutate((service) => service.saveMonthlyLight(draft)),
  };
}
