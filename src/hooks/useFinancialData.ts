import { useCallback, useEffect, useMemo, useState } from 'react';

import { ENABLE_FIRESTORE_DAILY_MONTHLY } from '@/config/featureFlags';
import { useAuth } from '@/providers';
import { firestoreDailyMonthlyDataSource, type DailyMonthlyQuery } from '@/services/costs';
import { loadAppData } from '@/services/data';
import type { UserDataSnapshot } from '@/services/data';

type UseFinancialDataOptions = {
  enabled?: boolean;
};

export function useFinancialData(
  query: DailyMonthlyQuery = { loadAll: true },
  options: UseFinancialDataOptions = {},
) {
  const { user } = useAuth();
  const userId = user?.id;
  const enabled = options.enabled ?? true;
  const [snapshot, setSnapshot] = useState<UserDataSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const queryKey = JSON.stringify(query);
  const stableQuery = useMemo(() => JSON.parse(queryKey) as DailyMonthlyQuery, [queryKey]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!userId) {
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(undefined);

      try {
        const baseSnapshot = await loadAppData(userId);
        setSnapshot((current) =>
          current && snapshotsEquivalent(current, baseSnapshot) ? current : baseSnapshot,
        );
        setLoading(false);

        if (ENABLE_FIRESTORE_DAILY_MONTHLY) {
          try {
            const costs = await firestoreDailyMonthlyDataSource.load(userId, stableQuery);
            setSnapshot((current) => {
              const base = current ?? baseSnapshot;
              const next = { ...base, ...costs };
              return snapshotsEquivalent(base, next) ? base : next;
            });
          } catch (remoteError) {
            if (__DEV__) console.warn('[useFinancialData] Firestore fallback local.', remoteError);
          }
        }
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
    [stableQuery, userId],
  );

  useEffect(() => {
    if (!enabled) return;
    void (async () => {
      await load();
    })();
  }, [enabled, load]);

  const reload = useCallback(() => load(true), [load]);

  return {
    snapshot,
    loading,
    refreshing,
    error,
    reload,
    refresh: reload,
  };
}

export type UseFinancialDataResult = ReturnType<typeof useFinancialData>;

function snapshotsEquivalent(left: UserDataSnapshot, right: UserDataSnapshot): boolean {
  return (
    deliveriesEquivalent(left.entregas, right.entregas) &&
    recordsEquivalent(left.gastosDiarios, right.gastosDiarios) &&
    recordsEquivalent(left.gastosMensais, right.gastosMensais) &&
    JSON.stringify(left.recebimentoBaldes) === JSON.stringify(right.recebimentoBaldes) &&
    JSON.stringify(left.clientesCustom) === JSON.stringify(right.clientesCustom)
  );
}

function deliveriesEquivalent(
  left: UserDataSnapshot['entregas'],
  right: UserDataSnapshot['entregas'],
): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  return left.every((delivery, index) => {
    const other = right[index];
    return (
      delivery.id === other.id &&
      delivery.cliente === other.cliente &&
      delivery.data === other.data &&
      delivery.quantidade === other.quantidade &&
      delivery.valor === other.valor &&
      delivery.status === other.status &&
      delivery.entregue === other.entregue &&
      delivery.precoUnitarioHistorico === other.precoUnitarioHistorico &&
      delivery.invoiceStatus === other.invoiceStatus &&
      delivery.metodoPagamento === other.metodoPagamento
    );
  });
}

function recordsEquivalent(
  left: UserDataSnapshot['gastosDiarios'] | UserDataSnapshot['gastosMensais'],
  right: UserDataSnapshot['gastosDiarios'] | UserDataSnapshot['gastosMensais'],
): boolean {
  if (left === right) return true;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => {
    const leftValue = left[key];
    const rightValue = right[key];
    return leftValue === rightValue || JSON.stringify(leftValue) === JSON.stringify(rightValue);
  });
}
