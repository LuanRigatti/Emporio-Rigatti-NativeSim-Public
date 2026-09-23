import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ENABLE_FIRESTORE_CLIENTS_DELIVERIES,
  ENABLE_FIRESTORE_DAILY_MONTHLY,
} from '@/config/featureFlags';
import { useAuth } from '@/providers';
import { firestoreDailyMonthlyDataSource, type DailyMonthlyQuery } from '@/services/costs';
import { loadAppData } from '@/services/data';
import type { AppDataLoadResult, UserDataSnapshot } from '@/services/data';
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
  coverage: FinancialDataCoverage;
};

export type FinancialDataCoverage = {
  source: 'none' | 'cache' | 'remote' | 'local';
  remoteComplete: boolean;
  routesCoverage: 'not-loaded' | 'local-only';
};

const EMPTY_COVERAGE: FinancialDataCoverage = {
  remoteComplete: false,
  routesCoverage: 'not-loaded',
  source: 'none',
};

const allTimeInFlight = new Map<string, Promise<AppDataLoadResult>>();

type FinancialDateRange = {
  endDate: string;
  startDate: string;
};

type FinancialBaseCoverage = {
  costs: FinancialDateRange[];
  costsAll: boolean;
  deliveries: FinancialDateRange[];
  deliveriesAll: boolean;
};

type FinancialBaseSnapshotEntry = {
  coverage: FinancialBaseCoverage;
  remoteComplete: boolean;
  source: AppDataLoadResult['source'];
  snapshot: UserDataSnapshot;
};

type LocallyDerivedSnapshot = {
  comparisonSnapshot: UserDataSnapshot | null;
  snapshot: UserDataSnapshot;
};

const baseSnapshotMemory = new Map<string, FinancialBaseSnapshotEntry>();

function loadAllTimeAppData(userId: string, sessionVersion: number): Promise<AppDataLoadResult> {
  const key = `${userId}:${sessionVersion}`;
  const existing = allTimeInFlight.get(key);
  if (existing) return existing;

  const operation = Promise.all([
    firestoreDeliveryDataSource.loadAllHistorical(userId, sessionVersion, { revalidate: true }),
    firestoreDailyMonthlyDataSource.loadWithMetadata(userId, { loadAll: true }),
  ])
    .then(([deliveries, costs]) => {
      const deliveriesRemoteComplete =
        firestoreDeliveryDataSource.getHistoricalDataState() === 'remote';
      const remoteComplete = deliveriesRemoteComplete && costs.remoteComplete;
      const baseSnapshot = {
        clientesCustom: {},
        entregas: [],
        gastosDiarios: {},
        gastosMensais: {},
        recebimentoBaldes: [],
      } satisfies UserDataSnapshot;

      return {
        isStale: !remoteComplete,
        snapshot: {
          ...baseSnapshot,
          entregas: deliveries,
          gastosDiarios: costs.snapshot.gastosDiarios,
          gastosMensais: costs.snapshot.gastosMensais,
        },
        source: remoteComplete ? ('network' as const) : ('cache' as const),
      };
    })
    .finally(() => {
      if (allTimeInFlight.get(key) === operation) allTimeInFlight.delete(key);
    });
  allTimeInFlight.set(key, operation);
  return operation;
}

function coverageForAppData(result: AppDataLoadResult): FinancialDataCoverage {
  return {
    remoteComplete: result.source === 'network' && !result.isStale,
    routesCoverage: 'local-only',
    source: result.source === 'network' ? 'remote' : result.source,
  };
}

function cacheCoverage(): FinancialDataCoverage {
  return {
    remoteComplete: false,
    routesCoverage: 'local-only',
    source: 'cache',
  };
}

function coverageEqual(left: FinancialDataCoverage, right: FinancialDataCoverage): boolean {
  return (
    left.remoteComplete === right.remoteComplete &&
    left.routesCoverage === right.routesCoverage &&
    left.source === right.source
  );
}

function baseSnapshotKey(userId: string, sessionVersion: number): string {
  return `${userId}:${sessionVersion}`;
}

function createBaseCoverage(isAllTimeQuery: boolean): FinancialBaseCoverage {
  return {
    costs: [],
    costsAll: isAllTimeQuery || !ENABLE_FIRESTORE_DAILY_MONTHLY,
    deliveries: [],
    deliveriesAll: isAllTimeQuery || !ENABLE_FIRESTORE_CLIENTS_DELIVERIES,
  };
}

function baseSourceQuality(source: AppDataLoadResult['source'], remoteComplete: boolean): number {
  if (source === 'network' && remoteComplete) return 3;
  if (source === 'cache') return 2;
  return 1;
}

function dateRangeForQuery(query: DailyMonthlyQuery): FinancialDateRange | null {
  if (query.loadAll) return null;
  if (query.date) return { endDate: query.date, startDate: query.date };
  if (query.month) {
    const [year, month] = query.month.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return {
      endDate: `${query.month}-${String(lastDay).padStart(2, '0')}`,
      startDate: `${query.month}-01`,
    };
  }
  if (!query.startDate || !query.endDate) return null;
  return { endDate: query.endDate, startDate: query.startDate };
}

function displayMonthPrimaryQuery(
  displayMonth: string,
  requestedQuery: DailyMonthlyQuery,
): DailyMonthlyQuery {
  const [year, month] = displayMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const requestedEndDate = requestedQuery.endDate?.startsWith(displayMonth)
    ? requestedQuery.endDate
    : `${displayMonth}-${String(lastDay).padStart(2, '0')}`;
  return {
    endDate: requestedEndDate,
    startDate: `${displayMonth}-01`,
  };
}

function coverageCoversRange(
  coverage: { all: boolean; ranges: readonly FinancialDateRange[] },
  range: FinancialDateRange | null,
): boolean {
  if (coverage.all || range === null) return coverage.all;
  return coverage.ranges.some(
    (knownRange) => knownRange.startDate <= range.startDate && knownRange.endDate >= range.endDate,
  );
}

function baseCoverageCoversQuery(
  coverage: FinancialBaseCoverage,
  query: DailyMonthlyQuery,
): boolean {
  const range = dateRangeForQuery(query);
  return (
    coverageCoversRange({ all: coverage.deliveriesAll, ranges: coverage.deliveries }, range) &&
    coverageCoversRange({ all: coverage.costsAll, ranges: coverage.costs }, range)
  );
}

function addCoverageRange(ranges: FinancialDateRange[], range: FinancialDateRange | null): void {
  if (!range) return;
  if (
    ranges.some(
      (knownRange) =>
        knownRange.startDate === range.startDate && knownRange.endDate === range.endDate,
    )
  ) {
    return;
  }
  ranges.push(range);
}

function isDateInRange(date: string, range: FinancialDateRange): boolean {
  return date >= range.startDate && date <= range.endDate;
}

function isMonthInRange(month: string, range: FinancialDateRange): boolean {
  return month >= range.startDate.slice(0, 7) && month <= range.endDate.slice(0, 7);
}

function mergeBaseSnapshots(
  current: UserDataSnapshot,
  incoming: UserDataSnapshot,
): UserDataSnapshot {
  const deliveries = new Map(current.entregas.map((delivery) => [delivery.id, delivery]));
  incoming.entregas.forEach((delivery) => deliveries.set(delivery.id, delivery));
  return {
    clientesCustom: { ...current.clientesCustom, ...incoming.clientesCustom },
    entregas: [...deliveries.values()],
    gastosDiarios: { ...current.gastosDiarios, ...incoming.gastosDiarios },
    gastosMensais: { ...current.gastosMensais, ...incoming.gastosMensais },
    pushToken: incoming.pushToken ?? current.pushToken,
    recebimentoBaldes: incoming.recebimentoBaldes,
  };
}

function replaceDeliveryRange(
  snapshot: UserDataSnapshot,
  sourceSnapshot: UserDataSnapshot,
  range: FinancialDateRange,
): UserDataSnapshot {
  const deliveries = snapshot.entregas.filter((delivery) => !isDateInRange(delivery.data, range));
  const replacement = sourceSnapshot.entregas.filter((delivery) =>
    isDateInRange(delivery.data, range),
  );
  const byId = new Map(deliveries.map((delivery) => [delivery.id, delivery]));
  replacement.forEach((delivery) => byId.set(delivery.id, delivery));
  return { ...snapshot, entregas: [...byId.values()] };
}

function replaceCostRange(
  snapshot: UserDataSnapshot,
  sourceSnapshot: UserDataSnapshot,
  range: FinancialDateRange,
): UserDataSnapshot {
  const gastosDiarios = Object.fromEntries(
    Object.entries(snapshot.gastosDiarios).filter(
      ([date, expense]) => !isDateInRange(expense.data ?? date, range),
    ),
  );
  Object.entries(sourceSnapshot.gastosDiarios).forEach(([date, expense]) => {
    if (isDateInRange(expense.data ?? date, range)) gastosDiarios[date] = expense;
  });

  const gastosMensais = Object.fromEntries(
    Object.entries(snapshot.gastosMensais).filter(([month]) => !isMonthInRange(month, range)),
  );
  Object.entries(sourceSnapshot.gastosMensais).forEach(([month, expense]) => {
    if (isMonthInRange(month, range)) gastosMensais[month] = expense;
  });

  return { ...snapshot, gastosDiarios, gastosMensais };
}

function rememberBaseSnapshot(
  userId: string,
  sessionVersion: number,
  baseSnapshot: UserDataSnapshot,
  options: {
    costsComplete: boolean;
    deliveriesComplete: boolean;
    isAllTimeQuery: boolean;
    query: DailyMonthlyQuery;
    allTimeCoverage?: boolean;
    remoteComplete: boolean;
    source: AppDataLoadResult['source'];
    sourceSnapshot?: UserDataSnapshot;
  },
): void {
  const key = baseSnapshotKey(userId, sessionVersion);
  for (const existingKey of baseSnapshotMemory.keys()) {
    if (existingKey.startsWith(`${userId}:`) && existingKey !== key) {
      baseSnapshotMemory.delete(existingKey);
    }
  }

  const previous = baseSnapshotMemory.get(key);

  if (options.isAllTimeQuery) {
    if (previous && !options.allTimeCoverage) return;
    baseSnapshotMemory.set(key, {
      coverage: createBaseCoverage(options.allTimeCoverage === true),
      remoteComplete: options.remoteComplete,
      source: options.source,
      snapshot: options.allTimeCoverage ? (options.sourceSnapshot ?? baseSnapshot) : baseSnapshot,
    });
    return;
  }

  const incomingQuality = baseSourceQuality(options.source, options.remoteComplete);
  const previousQuality = previous
    ? baseSourceQuality(previous.source, previous.remoteComplete)
    : 0;
  const canMergeBaseSnapshot = !previous || incomingQuality >= previousQuality;
  let snapshot =
    canMergeBaseSnapshot && previous
      ? mergeBaseSnapshots(previous.snapshot, baseSnapshot)
      : (previous?.snapshot ?? baseSnapshot);
  const coverage: FinancialBaseCoverage = previous
    ? {
        costs: [...previous.coverage.costs],
        costsAll: previous.coverage.costsAll,
        deliveries: [...previous.coverage.deliveries],
        deliveriesAll: previous.coverage.deliveriesAll,
      }
    : createBaseCoverage(false);
  const range = dateRangeForQuery(options.query);

  if (!ENABLE_FIRESTORE_CLIENTS_DELIVERIES || range === null) coverage.deliveriesAll = true;
  else if (options.deliveriesComplete) {
    addCoverageRange(coverage.deliveries, range);
    if (options.sourceSnapshot)
      snapshot = replaceDeliveryRange(snapshot, options.sourceSnapshot, range);
  }

  if (!ENABLE_FIRESTORE_DAILY_MONTHLY || range === null) coverage.costsAll = true;
  else if (options.costsComplete) {
    addCoverageRange(coverage.costs, range);
    if (options.sourceSnapshot)
      snapshot = replaceCostRange(snapshot, options.sourceSnapshot, range);
  }

  baseSnapshotMemory.set(key, {
    coverage,
    remoteComplete: canMergeBaseSnapshot
      ? options.remoteComplete
      : (previous?.remoteComplete ?? false),
    source: canMergeBaseSnapshot ? options.source : (previous?.source ?? options.source),
    snapshot,
  });
}

function deriveSnapshotFromBase(
  entry: FinancialBaseSnapshotEntry,
  query: DailyMonthlyQuery,
  displayMonth: string | undefined,
): LocallyDerivedSnapshot | null {
  const primaryQuery = displayMonth ? displayMonthPrimaryQuery(displayMonth, query) : query;
  if (!baseCoverageCoversQuery(entry.coverage, primaryQuery)) return null;

  const primarySourceSnapshot = scopeSnapshotToQuery(
    entry.snapshot,
    primaryQuery,
    deliveryFiltersForQuery(primaryQuery),
  );
  const comparisonSnapshot =
    displayMonth && baseCoverageCoversQuery(entry.coverage, query)
      ? scopeSnapshotToQuery(entry.snapshot, query, deliveryFiltersForQuery(query))
      : null;
  return {
    comparisonSnapshot,
    snapshot: displayMonth
      ? scopeSnapshotToDisplayMonth(primarySourceSnapshot, displayMonth)
      : primarySourceSnapshot,
  };
}

export function useFinancialData(
  query: DailyMonthlyQuery = { loadAll: true },
  options: UseFinancialDataOptions = {},
) {
  const { sessionVersion, user } = useAuth();
  const userId = user?.id;
  const enabled = options.enabled ?? true;
  const displayMonth = options.displayMonth;
  const queryKey = JSON.stringify(query);
  const stableQuery = useMemo(() => JSON.parse(queryKey) as DailyMonthlyQuery, [queryKey]);
  const isAllTimeQuery = stableQuery.loadAll === true;
  const snapshotScopeKey = isAllTimeQuery ? 'all' : (displayMonth ?? queryKey);
  const initialCacheEntry =
    userId && displayMonth ? financialPeriodSnapshotCache.getMemory(userId, displayMonth) : null;
  const initialAllTimeCacheEntry =
    userId && isAllTimeQuery
      ? financialPeriodSnapshotCache.getAllTimeMemory(userId, sessionVersion)
      : null;
  const initialCachedSnapshot = initialCacheEntry
    ? scopeSnapshotToDisplayMonth(initialCacheEntry.snapshot, displayMonth)
    : (initialAllTimeCacheEntry?.snapshot ?? null);
  const hasInitialCachedSnapshot = isAllTimeQuery
    ? initialAllTimeCacheEntry !== null
    : initialCachedSnapshot !== null &&
      snapshotsEquivalent(
        initialCachedSnapshot,
        initialCacheEntry?.snapshot ?? initialCachedSnapshot,
      );
  const [resolvedSnapshot, setResolvedSnapshot] = useState<ResolvedFinancialSnapshot>(() => ({
    snapshot: hasInitialCachedSnapshot ? initialCachedSnapshot : null,
    comparisonSnapshot:
      hasInitialCachedSnapshot && !isAllTimeQuery
        ? (initialCacheEntry?.comparisonSnapshot ?? null)
        : null,
    scopeKey: hasInitialCachedSnapshot ? snapshotScopeKey : undefined,
    coverage: hasInitialCachedSnapshot ? cacheCoverage() : EMPTY_COVERAGE,
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
  const {
    comparisonSnapshot,
    coverage,
    scopeKey: resolvedSnapshotScopeKey,
    snapshot,
  } = resolvedSnapshot;
  const hasSnapshotForRequestedScope =
    snapshot !== null && resolvedSnapshotScopeKey === snapshotScopeKey;
  const hasCachedSnapshotForRequestedScope =
    !hasSnapshotForRequestedScope && hasInitialCachedSnapshot && initialCachedSnapshot !== null;
  const baseSnapshotEntry = userId
    ? baseSnapshotMemory.get(baseSnapshotKey(userId, sessionVersion))
    : null;
  const locallyDerivedSnapshot =
    !hasSnapshotForRequestedScope && baseSnapshotEntry
      ? deriveSnapshotFromBase(baseSnapshotEntry, stableQuery, displayMonth)
      : null;
  const hasLocallyDerivedSnapshot = locallyDerivedSnapshot !== null;
  const visibleSnapshot = hasSnapshotForRequestedScope
    ? snapshot
    : hasCachedSnapshotForRequestedScope
      ? initialCachedSnapshot
      : hasLocallyDerivedSnapshot
        ? locallyDerivedSnapshot.snapshot
        : snapshot;
  const visibleComparisonSnapshot = hasSnapshotForRequestedScope
    ? comparisonSnapshot
    : hasCachedSnapshotForRequestedScope
      ? (initialCacheEntry?.comparisonSnapshot ?? null)
      : hasLocallyDerivedSnapshot
        ? locallyDerivedSnapshot.comparisonSnapshot
        : comparisonSnapshot;
  const visibleCoverage = hasSnapshotForRequestedScope
    ? coverage
    : hasCachedSnapshotForRequestedScope || hasLocallyDerivedSnapshot
      ? cacheCoverage()
      : coverage;
  const visibleSnapshotScopeKey = hasCachedSnapshotForRequestedScope
    ? snapshotScopeKey
    : hasLocallyDerivedSnapshot
      ? snapshotScopeKey
      : resolvedSnapshotScopeKey;
  const visibleLoading = hasCachedSnapshotForRequestedScope
    ? false
    : hasLocallyDerivedSnapshot
      ? false
      : snapshot === null || resolvedSnapshotScopeKey !== snapshotScopeKey
        ? true
        : loading;
  const visibleRefreshing =
    hasCachedSnapshotForRequestedScope || !enabled
      ? false
      : hasLocallyDerivedSnapshot
        ? true
        : refreshing;

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
        const allTimeCacheEntryPromise = isAllTimeQuery
          ? financialPeriodSnapshotCache.readAllTime(userId, sessionVersion)
          : Promise.resolve(null);
        const baseSnapshotPromise: Promise<AppDataLoadResult> = isAllTimeQuery
          ? loadAllTimeAppData(userId, sessionVersion)
          : loadAppData(userId).then((snapshot) => ({
              isStale: false,
              snapshot,
              source: 'network',
            }));
        const cachedEntry = await cachedEntryPromise;
        const allTimeCacheEntry = await allTimeCacheEntryPromise;
        if (allTimeCacheEntry && isCurrent()) {
          rememberBaseSnapshot(userId, sessionVersion, allTimeCacheEntry.snapshot, {
            allTimeCoverage: true,
            costsComplete: true,
            deliveriesComplete: true,
            isAllTimeQuery: true,
            query: stableQuery,
            remoteComplete: false,
            source: 'cache',
            sourceSnapshot: allTimeCacheEntry.snapshot,
          });
          snapshotRef.current = allTimeCacheEntry.snapshot;
          snapshotScopeRef.current = snapshotScopeKey;
          setResolvedSnapshot({
            comparisonSnapshot: null,
            coverage: cacheCoverage(),
            scopeKey: snapshotScopeKey,
            snapshot: allTimeCacheEntry.snapshot,
          });
          setLoading(false);
          setRefreshing(true);
        }
        if (cachedEntry && isCurrent()) {
          const cachedSnapshot = scopeSnapshotToDisplayMonth(cachedEntry.snapshot, displayMonth);
          if (snapshotsEquivalent(cachedSnapshot, cachedEntry.snapshot)) {
            snapshotRef.current = cachedSnapshot;
            snapshotScopeRef.current = snapshotScopeKey;
            setResolvedSnapshot({
              comparisonSnapshot: cachedEntry.comparisonSnapshot,
              coverage: cacheCoverage(),
              scopeKey: snapshotScopeKey,
              snapshot: cachedSnapshot,
            });
            setLoading(false);
            setRefreshing(true);
          }
        }

        const baseData = await baseSnapshotPromise;
        if (!isCurrent()) return;
        const baseSnapshot = baseData.snapshot;

        const deliveryFilters = deliveryFiltersForQuery(stableQuery);
        const localSnapshot = scopeSnapshotToQuery(baseSnapshot, stableQuery, deliveryFilters);
        const awaitingRemoteDeliveries =
          ENABLE_FIRESTORE_CLIENTS_DELIVERIES && deliveryFilters !== undefined;
        const initialSourceSnapshot = awaitingRemoteDeliveries
          ? { ...localSnapshot, entregas: [] }
          : localSnapshot;
        let latestSourceSnapshot = initialSourceSnapshot;
        let deliveriesComplete = !awaitingRemoteDeliveries;
        let costsComplete = !ENABLE_FIRESTORE_DAILY_MONTHLY || isAllTimeQuery;
        let remoteDataComplete = isAllTimeQuery
          ? coverageForAppData(baseData).remoteComplete
          : true;
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
            const nextCoverage = isAllTimeQuery
              ? coverageForAppData(baseData)
              : {
                  remoteComplete: remoteDataComplete,
                  routesCoverage: 'not-loaded' as const,
                  source: 'remote' as const,
                };
            if (
              current.comparisonSnapshot === nextComparisonSnapshot &&
              current.scopeKey === snapshotScopeKey &&
              current.snapshot === nextSnapshot &&
              coverageEqual(current.coverage, nextCoverage)
            ) {
              return current;
            }
            return {
              comparisonSnapshot: nextComparisonSnapshot,
              coverage: nextCoverage,
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
            deliveriesComplete = true;
          } catch (remoteError) {
            if (__DEV__)
              console.warn('[useFinancialData] Firestore deliveries fallback local.', remoteError);
            if (isCurrent()) {
              latestSourceSnapshot = localSnapshot;
              remoteDataComplete = false;
            }
          }
        }

        if (ENABLE_FIRESTORE_DAILY_MONTHLY && !isAllTimeQuery) {
          try {
            const costs = await firestoreDailyMonthlyDataSource.load(userId, stableQuery);
            if (!isCurrent()) return;
            latestSourceSnapshot = {
              ...latestSourceSnapshot,
              gastosDiarios: costs.gastosDiarios,
              gastosMensais: costs.gastosMensais,
            };
            costsComplete = true;
          } catch (remoteError) {
            if (__DEV__) console.warn('[useFinancialData] Firestore fallback local.', remoteError);
            remoteDataComplete = false;
          }
        }

        if (isCurrent()) {
          rememberBaseSnapshot(userId, sessionVersion, baseSnapshot, {
            allTimeCoverage: isAllTimeQuery && baseData.source === 'network' && !baseData.isStale,
            costsComplete,
            deliveriesComplete,
            isAllTimeQuery,
            query: stableQuery,
            remoteComplete: isAllTimeQuery ? remoteDataComplete : false,
            source: isAllTimeQuery ? baseData.source : 'local',
            sourceSnapshot: latestSourceSnapshot,
          });
          publishSnapshot(latestSourceSnapshot);
          if (isAllTimeQuery && baseData.source === 'cache' && baseData.isStale) {
            setError('A atualização remota dos dados financeiros ainda não foi confirmada.');
          }
          if (displayMonth && remoteDataComplete) {
            const visibleSnapshot = scopeSnapshotToDisplayMonth(latestSourceSnapshot, displayMonth);
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
          if (isAllTimeQuery && remoteDataComplete) {
            void financialPeriodSnapshotCache
              .writeAllTime(userId, sessionVersion, latestSourceSnapshot)
              .catch((cacheError) => {
                if (__DEV__)
                  console.warn(
                    '[useFinancialData] Financial all-time cache write failed.',
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
    [displayMonth, isAllTimeQuery, sessionVersion, snapshotScopeKey, stableQuery, userId],
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
    coverage: visibleCoverage,
    remoteComplete: visibleCoverage.remoteComplete,
    routesCoverage: visibleCoverage.routesCoverage,
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
