import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ENABLE_FIRESTORE_CLIENTS_DELIVERIES,
  ENABLE_FIRESTORE_DAILY_MONTHLY,
} from '@/config/featureFlags';
import { useAuth } from '@/providers';
import { firestoreDailyMonthlyDataSource, type DailyMonthlyQuery } from '@/services/costs';
import { loadAppData } from '@/services/data';
import type { UserDataSnapshot } from '@/services/data';
import { firestoreDeliveryDataSource, deliveryQueryService } from '@/services/deliveries';
import { financialPeriodSnapshotCache } from '@/services/finance/FinancialPeriodSnapshotCache';
import type { DeliveryFilters } from '@/types/data';

type UseFinancialDataOptions = {
  enabled?: boolean;
  displayMonth?: string;
};

type ResolvedFinancialSnapshot = {
  snapshot: UserDataSnapshot | null;
  comparisonSnapshot: UserDataSnapshot | null;
  scopeKey?: string;
};

export function useFinancialData(
  query: DailyMonthlyQuery = { loadAll: true },
  options: UseFinancialDataOptions = {},
) {
  const { user } = useAuth();
  const userId = user?.id;
  const enabled = options.enabled ?? true;
  const displayMonth = options.displayMonth;
  const queryKey = JSON.stringify(query);
  const snapshotScopeKey = displayMonth ?? queryKey;
  const stableQuery = useMemo(() => JSON.parse(queryKey) as DailyMonthlyQuery, [queryKey]);
  const initialCacheEntry =
    userId && displayMonth ? financialPeriodSnapshotCache.getMemory(userId, displayMonth) : null;
  const initialCachedSnapshot = initialCacheEntry
    ? scopeSnapshotToDisplayMonth(initialCacheEntry.snapshot, displayMonth)
    : null;
  const hasInitialCachedSnapshot =
    initialCachedSnapshot !== null &&
    snapshotsEquivalent(initialCachedSnapshot, initialCacheEntry?.snapshot ?? initialCachedSnapshot);
  const [resolvedSnapshot, setResolvedSnapshot] = useState<ResolvedFinancialSnapshot>(() => ({
    snapshot: hasInitialCachedSnapshot ? initialCachedSnapshot : null,
    comparisonSnapshot: hasInitialCachedSnapshot
      ? initialCacheEntry?.comparisonSnapshot ?? null
      : null,
    scopeKey: hasInitialCachedSnapshot ? snapshotScopeKey : undefined,
  }));
  const [loading, setLoading] = useState(!hasInitialCachedSnapshot);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const loadVersion = useRef(0);
  const snapshotRef = useRef<UserDataSnapshot | null>(
    hasInitialCachedSnapshot ? initialCachedSnapshot : null,
  );
  const snapshotScopeRef = useRef<string | undefined>(
    hasInitialCachedSnapshot ? snapshotScopeKey : undefined,
  );
  const { comparisonSnapshot, scopeKey: resolvedSnapshotScopeKey, snapshot } = resolvedSnapshot;
  const hasSnapshotForRequestedScope =
    snapshot !== null && resolvedSnapshotScopeKey === snapshotScopeKey;
  const hasCachedSnapshotForRequestedScope =
    !hasSnapshotForRequestedScope && hasInitialCachedSnapshot && initialCachedSnapshot !== null;
  const visibleSnapshot = hasCachedSnapshotForRequestedScope ? initialCachedSnapshot : snapshot;
  const visibleComparisonSnapshot = hasCachedSnapshotForRequestedScope
    ? initialCacheEntry?.comparisonSnapshot ?? null
    : comparisonSnapshot;
  const visibleSnapshotScopeKey = hasCachedSnapshotForRequestedScope
    ? snapshotScopeKey
    : resolvedSnapshotScopeKey;
  const visibleLoading = hasCachedSnapshotForRequestedScope
    ? false
    : snapshot === null || resolvedSnapshotScopeKey !== snapshotScopeKey
      ? true
      : loading;
  const visibleRefreshing = hasCachedSnapshotForRequestedScope ? false : refreshing;

  const load = useCallback(
    async (isRefresh = false) => {
      const version = ++loadVersion.current;
      const isCurrent = () => loadVersion.current === version;
      if (!userId) {
        if (isCurrent()) setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else if (snapshotRef.current === null || snapshotScopeRef.current !== snapshotScopeKey) {
        setLoading(true);
      }
      setError(undefined);

      try {
        const cachedEntryPromise = displayMonth
          ? financialPeriodSnapshotCache.read(userId, displayMonth)
          : Promise.resolve(null);
        const baseSnapshotPromise = loadAppData(userId);
        const cachedEntry = await cachedEntryPromise;
        if (cachedEntry && isCurrent()) {
          const cachedSnapshot = scopeSnapshotToDisplayMonth(
            cachedEntry.snapshot,
            displayMonth,
          );
          if (snapshotsEquivalent(cachedSnapshot, cachedEntry.snapshot)) {
            snapshotRef.current = cachedSnapshot;
            snapshotScopeRef.current = snapshotScopeKey;
            setResolvedSnapshot({
              comparisonSnapshot: cachedEntry.comparisonSnapshot,
              scopeKey: snapshotScopeKey,
              snapshot: cachedSnapshot,
            });
            setLoading(false);
            setRefreshing(true);
          }
        }

        const baseSnapshot = await baseSnapshotPromise;
        if (!isCurrent()) return;

        const deliveryFilters = deliveryFiltersForQuery(stableQuery);
        const localSnapshot = scopeSnapshotToQuery(baseSnapshot, stableQuery, deliveryFilters);
        const awaitingRemoteDeliveries =
          ENABLE_FIRESTORE_CLIENTS_DELIVERIES && deliveryFilters !== undefined;
        const initialSourceSnapshot = awaitingRemoteDeliveries
          ? { ...localSnapshot, entregas: [] }
          : localSnapshot;
        let latestSourceSnapshot = initialSourceSnapshot;
        let remoteDataComplete = true;
        const publishSnapshot = (sourceSnapshot: UserDataSnapshot) => {
          latestSourceSnapshot = sourceSnapshot;
          const visibleSnapshot = scopeSnapshotToDisplayMonth(sourceSnapshot, displayMonth);
          snapshotRef.current = visibleSnapshot;
          snapshotScopeRef.current = snapshotScopeKey;
          setResolvedSnapshot((current) => {
            const nextComparisonSnapshot =
              current.comparisonSnapshot &&
              snapshotsEquivalent(current.comparisonSnapshot, sourceSnapshot)
                ? current.comparisonSnapshot
                : sourceSnapshot;
            const nextSnapshot =
              current.snapshot && snapshotsEquivalent(current.snapshot, visibleSnapshot)
                ? current.snapshot
                : visibleSnapshot;
            if (
              current.comparisonSnapshot === nextComparisonSnapshot &&
              current.scopeKey === snapshotScopeKey &&
              current.snapshot === nextSnapshot
            ) {
              return current;
            }
            return {
              comparisonSnapshot: nextComparisonSnapshot,
              scopeKey: snapshotScopeKey,
              snapshot: nextSnapshot,
            };
          });
        };
        if (ENABLE_FIRESTORE_CLIENTS_DELIVERIES && deliveryFilters) {
          try {
            const deliveries = await firestoreDeliveryDataSource.load(userId, deliveryFilters);
            if (!isCurrent()) return;
            latestSourceSnapshot = {
              ...latestSourceSnapshot,
              entregas: deliveries,
            };
          } catch (remoteError) {
            if (__DEV__)
              console.warn('[useFinancialData] Firestore deliveries fallback local.', remoteError);
            if (isCurrent()) {
              latestSourceSnapshot = localSnapshot;
              remoteDataComplete = false;
            }
          }
        }

        if (ENABLE_FIRESTORE_DAILY_MONTHLY) {
          try {
            const costs = await firestoreDailyMonthlyDataSource.load(userId, stableQuery);
            if (!isCurrent()) return;
            latestSourceSnapshot = {
              ...latestSourceSnapshot,
              gastosDiarios: costs.gastosDiarios,
              gastosMensais: costs.gastosMensais,
            };
          } catch (remoteError) {
            if (__DEV__) console.warn('[useFinancialData] Firestore fallback local.', remoteError);
            remoteDataComplete = false;
          }
        }

        if (isCurrent()) {
          publishSnapshot(latestSourceSnapshot);
          if (displayMonth && remoteDataComplete) {
            const visibleSnapshot = scopeSnapshotToDisplayMonth(
              latestSourceSnapshot,
              displayMonth,
            );
            void financialPeriodSnapshotCache
              .write(userId, displayMonth, visibleSnapshot, latestSourceSnapshot)
              .catch((cacheError) => {
                if (__DEV__)
                  console.warn(
                    '[useFinancialData] Financial period cache write failed.',
                    cacheError,
                  );
              });
          }
          setLoading(false);
        }
      } catch (loadError) {
        if (!isCurrent()) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar os dados financeiros.',
        );
      } finally {
        if (isCurrent()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [displayMonth, snapshotScopeKey, stableQuery, userId],
  );

  useEffect(() => {
    if (!enabled) return;
    void (async () => {
      await load();
    })();
  }, [enabled, load]);

  const reload = useCallback(() => load(true), [load]);

  return {
    snapshot: visibleSnapshot,
    comparisonSnapshot: visibleComparisonSnapshot,
    snapshotScopeKey: visibleSnapshotScopeKey,
    loading: visibleLoading,
    refreshing: visibleRefreshing,
    error,
    reload,
    refresh: reload,
  };
}

export type UseFinancialDataResult = ReturnType<typeof useFinancialData>;

function deliveryFiltersForQuery(query: DailyMonthlyQuery): DeliveryFilters | undefined {
  if (query.loadAll) return undefined;
  if (!query.date && !query.month && !query.startDate && !query.endDate) return undefined;
  if (query.month) {
    const [year, month] = query.month.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return {
      mode: 'all',
      startDate: `${query.month}-01`,
      endDate: `${query.month}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  return {
    mode: 'all',
    ...(query.date ? { date: query.date } : {}),
    ...(query.startDate ? { startDate: query.startDate } : {}),
    ...(query.endDate ? { endDate: query.endDate } : {}),
  };
}

function scopeSnapshotToQuery(
  snapshot: UserDataSnapshot,
  query: DailyMonthlyQuery,
  deliveryFilters: DeliveryFilters | undefined,
): UserDataSnapshot {
  const deliveries = deliveryFilters
    ? deliveryQueryService.filter(snapshot.entregas, deliveryFilters)
    : snapshot.entregas;
  const dailyEntries = Object.entries(snapshot.gastosDiarios).filter(([date, expense]) =>
    matchesCostQuery(date, expense.data, query),
  );
  const monthlyEntries = Object.entries(snapshot.gastosMensais).filter(([month]) =>
    matchesMonthlyQuery(month, query),
  );
  return {
    ...snapshot,
    entregas: deliveries,
    gastosDiarios: Object.fromEntries(dailyEntries),
    gastosMensais: Object.fromEntries(monthlyEntries),
  };
}

function scopeSnapshotToDisplayMonth(
  snapshot: UserDataSnapshot,
  displayMonth: string | undefined,
): UserDataSnapshot {
  if (!displayMonth) return snapshot;
  const [year, month] = displayMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const deliveries = deliveryQueryService.filter(snapshot.entregas, {
    mode: 'all',
    startDate: `${displayMonth}-01`,
    endDate: `${displayMonth}-${String(lastDay).padStart(2, '0')}`,
  });
  const dailyEntries = Object.entries(snapshot.gastosDiarios).filter(([date, expense]) =>
    (expense.data ?? date).startsWith(displayMonth),
  );
  const monthlyEntries = Object.entries(snapshot.gastosMensais).filter(
    ([monthKey]) => monthKey === displayMonth,
  );
  return {
    ...snapshot,
    entregas: deliveries,
    gastosDiarios: Object.fromEntries(dailyEntries),
    gastosMensais: Object.fromEntries(monthlyEntries),
  };
}

function matchesCostQuery(
  key: string,
  data: string | undefined,
  query: DailyMonthlyQuery,
): boolean {
  if (query.loadAll) return true;
  const date = data ?? key;
  if (query.date) return date === query.date;
  if (query.month) return date.startsWith(query.month);
  return (!query.startDate || date >= query.startDate) && (!query.endDate || date <= query.endDate);
}

function matchesMonthlyQuery(month: string, query: DailyMonthlyQuery): boolean {
  if (query.loadAll) return true;
  if (query.month) return month === query.month;
  const start = query.startDate?.slice(0, 7);
  const end = query.endDate?.slice(0, 7);
  return (!start || month >= start) && (!end || month <= end);
}

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
