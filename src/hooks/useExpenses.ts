import { useCallback, useEffect, useMemo, useState } from 'react';

import { ENABLE_FIRESTORE_DAILY_MONTHLY } from '@/config/featureFlags';
import { useAuth } from '@/providers';
import {
  dailyExpenseToCostValues,
  firestoreDailyMonthlyDataSource,
  localDailyDataDataSource,
  type CostValues,
} from '@/services/costs';
import { loadAppData } from '@/services/data';
import type { UserDataSnapshot } from '@/services/data';
import { createExpenseMutationService, expenseQueryService } from '@/services/expenses';
import type { DailyExpenseDraft, ExpenseFilters, MonthlyLightDraft } from '@/types/data';
import { normalizeLegacyDate } from '@/utils/data';

export function useExpenses(filters: ExpenseFilters = { period: 'day' }) {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<UserDataSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const filtersKey = JSON.stringify(filters);
  const stableFilters = useMemo(() => JSON.parse(filtersKey) as ExpenseFilters, [filtersKey]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(undefined);
      try {
        const baseSnapshot = await loadAppData(user.id);
        setSnapshot(baseSnapshot);
        setLoading(false);

        if (ENABLE_FIRESTORE_DAILY_MONTHLY) {
          try {
            const costs = await firestoreDailyMonthlyDataSource.load(
              user.id,
              firestoreQueryForExpenseFilters(stableFilters),
            );
            setSnapshot((current) => ({ ...(current ?? baseSnapshot), ...costs }));
          } catch (remoteError) {
            if (__DEV__) console.warn('[useExpenses] Firestore fallback local.', remoteError);
          }
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : 'Não foi possível carregar os gastos.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [stableFilters, user],
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
  const dailyExpenses = useMemo(
    () => (snapshot ? expenseQueryService.listDailyExpenses(snapshot.gastosDiarios, filters) : []),
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

  const saveDaily = useCallback(
    async (draft: DailyExpenseDraft) => {
      if (!user) throw new Error('Sessão não disponível.');
      if (!ENABLE_FIRESTORE_DAILY_MONTHLY) {
        await mutate((service) => service.saveDailyExpense(draft));
        return;
      }

      const date = normalizeLegacyDate(draft.date) ?? draft.date;
      const previous = snapshot?.gastosDiarios[date];
      const values = dailyExpenseToCostValues(previous);
      values.estar = String(draft.estar);
      values.kilometers = String(draft.km);
      values.fuelPrice = String(draft.fuelPrice);
      if (draft.fuelType !== undefined) values.fuelType = draft.fuelType;
      if (draft.legacyFuelCost !== undefined) values.fuel = String(draft.legacyFuelCost);

      try {
        const saved = await firestoreDailyMonthlyDataSource.saveDaily(user.id, date, values);
        setSnapshot((current) =>
          current
            ? { ...current, gastosDiarios: { ...current.gastosDiarios, [date]: saved } }
            : current,
        );
      } catch (remoteError) {
        if (__DEV__) console.warn('[useExpenses] Firestore save fallback local.', remoteError);
        await saveDailyLocally(user.id, date, values);
        setSnapshot((current) =>
          current
            ? {
                ...current,
                gastosDiarios: {
                  ...current.gastosDiarios,
                  [date]: {
                    ...previous,
                    data: date,
                    estar: draft.estar,
                    km: draft.km,
                    precoGasolina: draft.fuelPrice,
                    ...(draft.fuelType ? { tipoCombustivel: draft.fuelType } : {}),
                    ...(draft.legacyFuelCost === undefined
                      ? {}
                      : { gasolina: draft.legacyFuelCost }),
                  },
                },
              }
            : current,
        );
      }
    },
    [mutate, snapshot, user],
  );

  const saveMonthly = useCallback(
    async (draft: MonthlyLightDraft) => {
      if (!user) throw new Error('Sessão não disponível.');
      if (!ENABLE_FIRESTORE_DAILY_MONTHLY) {
        await mutate((service) => service.saveMonthlyLight(draft));
        return;
      }

      const values: CostValues = {
        estar: '',
        fuel: '',
        fuelPrice: '',
        fuelType: '',
        kilometers: '',
        light: String(draft.light),
        other: '',
      };
      try {
        const saved = await firestoreDailyMonthlyDataSource.saveMonthly(
          user.id,
          draft.month,
          values,
        );
        setSnapshot((current) =>
          current
            ? { ...current, gastosMensais: { ...current.gastosMensais, [draft.month]: saved } }
            : current,
        );
      } catch (remoteError) {
        if (__DEV__) console.warn('[useExpenses] Firestore save fallback local.', remoteError);
        await saveMonthlyLocally(user.id, draft.month, values);
        setSnapshot((current) =>
          current
            ? {
                ...current,
                gastosMensais: {
                  ...current.gastosMensais,
                  [draft.month]: {
                    ...(current.gastosMensais[draft.month] as object),
                    luz: draft.light,
                  },
                },
              }
            : current,
        );
      }
    },
    [mutate, user],
  );

  return {
    snapshot,
    summary,
    dailyExpenses,
    loading,
    refreshing,
    error,
    reload: () => load(true),
    saveDailyExpense: saveDaily,
    saveMonthlyLight: saveMonthly,
  };
}

async function saveDailyLocally(uid: string, date: string, values: CostValues): Promise<void> {
  const settings = await localDailyDataDataSource.load(uid);
  await localDailyDataDataSource.save(
    {
      ...settings,
      periods: {
        ...settings.periods,
        day: { ...settings.periods.day, [date]: values },
      },
    },
    uid,
  );
}

async function saveMonthlyLocally(uid: string, month: string, values: CostValues): Promise<void> {
  const settings = await localDailyDataDataSource.load(uid);
  await localDailyDataDataSource.save(
    {
      ...settings,
      periods: {
        ...settings.periods,
        month: { ...settings.periods.month, [month]: values },
      },
    },
    uid,
  );
}

function firestoreQueryForExpenseFilters(filters: ExpenseFilters) {
  if (filters.period === 'all') return { loadAll: true } as const;
  if (filters.period === 'day') return { date: filters.date } as const;
  if (filters.period === 'month') return { month: filters.month } as const;
  const range = expenseRange(filters);
  return { startDate: range.start, endDate: range.end } as const;
}

function expenseRange(filters: ExpenseFilters): { start: string; end: string } {
  if (filters.startDate && filters.endDate) {
    return { start: filters.startDate, end: filters.endDate };
  }
  const date = filters.date ?? new Date().toISOString().slice(0, 10);
  const base = new Date(`${date}T12:00:00`);
  const start = new Date(base);
  start.setDate(base.getDate() - base.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}
