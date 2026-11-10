import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  ENABLE_FIRESTORE_CLIENTS_DELIVERIES,
  ENABLE_FIRESTORE_DAILY_MONTHLY,
} from '@/config/featureFlags';
import { useAuth } from '@/providers';
import { isActiveAuthSession } from '@/services/auth/ActiveAuthSession';
import { firestoreDailyMonthlyDataSource, type DailyMonthlyQuery } from '@/services/costs';
import { loadAppData } from '@/services/data';
import type { AppDataLoadResult, UserDataSnapshot } from '@/services/data';
import {
  firestoreDeliveryDataSource,
  deliveryQueryService,
  HISTORICAL_DELIVERY_QUERY_SCOPE,
} from '@/services/deliveries';
import { financialPeriodSnapshotCache } from '@/services/finance/FinancialPeriodSnapshotCache';
import {
  firestoreQueryScopeKey,
  type FirestoreQueryCoverage,
  type FirestoreQueryOrigin,
  type FirestoreQueryProvenance,
} from '@/services/data/FirestoreQueryProvenance';
import type { DeliveryFilters } from '@/types/data';

type UseFinancialDataOptions = {
  enabled?: boolean;
  displayMonth?: string;
  skipRefreshWhenCached?: boolean;
};

type ResolvedFinancialSnapshot = {
  snapshot: UserDataSnapshot | null;
  comparisonSnapshot: UserDataSnapshot | null;
  scopeKey?: string;
  requestScopeKey?: string;
  sessionScopeKey?: string | null;
  cacheDisplayMonth?: string;
  cacheInvalidationVersion?: number;
  coverage: FinancialDataCoverage;
};

type ConfirmedDeliveryPreview = {
  cacheInvalidationVersion: number;
  deliveries: UserDataSnapshot['entregas'];
  displayMonth: string;
  loadVersion: number;
  requestScopeKey: string;
  sessionScopeKey: string;
  uid: string;
};

export type FinancialDatasetCoverage = {
  coverage: FirestoreQueryCoverage;
  fromCache: boolean | null;
  hasPendingWrites: boolean | null;
  origin: FirestoreQueryOrigin;
  remoteConfirmed: boolean;
  scopeKey: string;
};

export type FinancialDataCoverage = {
  source: 'none' | 'cache' | 'remote' | 'local';
  remoteComplete: boolean;
  routesCoverage: 'not-loaded' | 'local-only';
  requestScopeKey?: string;
  costs?: FinancialDatasetCoverage;
  deliveries?: FinancialDatasetCoverage;
};

const EMPTY_COVERAGE: FinancialDataCoverage = {
  remoteComplete: false,
  routesCoverage: 'not-loaded',
  source: 'none',
};

type FinancialAppDataLoadResult = AppDataLoadResult & {
  financialCoverage?: FinancialDataCoverage;
};

const allTimeInFlight = new Map<string, Promise<FinancialAppDataLoadResult>>();

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

function loadAllTimeAppData(
  userId: string,
  sessionVersion: number,
): Promise<FinancialAppDataLoadResult> {
  const key = `${userId}:${sessionVersion}`;
  const existing = allTimeInFlight.get(key);
  if (existing) return existing;

  const operation = Promise.all([
    firestoreDeliveryDataSource.loadAllHistoricalWithMetadata(userId, sessionVersion, {
      revalidate: true,
    }),
    firestoreDailyMonthlyDataSource.loadWithMetadata(userId, { loadAll: true }, { sessionVersion }),
  ])
    .then(([deliveries, costs]) => {
      const deliveryScopeMatches = queryProvenanceMatches(
        deliveries.provenance,
        'historical-deliveries',
        userId,
        sessionVersion,
        HISTORICAL_DELIVERY_QUERY_SCOPE,
      );
      const costScopeMatches = queryProvenanceMatches(
        costs.provenance,
        'daily-monthly-costs',
        userId,
        sessionVersion,
        { loadAll: true },
      );
      const deliveriesCoverage = datasetCoverageForQuery(
        deliveryScopeMatches ? deliveries.provenance : undefined,
        'historical-deliveries',
        userId,
        sessionVersion,
        HISTORICAL_DELIVERY_QUERY_SCOPE,
      );
      const costsCoverage = datasetCoverageForQuery(
        costScopeMatches ? costs.provenance : undefined,
        'daily-monthly-costs',
        userId,
        sessionVersion,
        { loadAll: true },
      );
      const financialCoverage = {
        ...periodCoverage(
          JSON.stringify([userId, sessionVersion, 'all']),
          costsCoverage,
          deliveriesCoverage,
        ),
        routesCoverage: 'local-only' as const,
      };
      const remoteComplete = financialCoverage.remoteComplete;
      const exactDeliveries = !deliveryScopeMatches
        ? []
        : deliveries.provenance.remoteConfirmed || deliveries.querySnapshot.length > 0
          ? deliveries.querySnapshot
          : deliveries.deliveries;
      const exactCosts = !costScopeMatches
        ? { gastosDiarios: {}, gastosMensais: {} }
        : costs.provenance.remoteConfirmed ||
            Object.keys(costs.querySnapshot.gastosDiarios).length > 0 ||
            Object.keys(costs.querySnapshot.gastosMensais).length > 0
          ? costs.querySnapshot
          : costs.snapshot;
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
          entregas: exactDeliveries,
          gastosDiarios: exactCosts.gastosDiarios,
          gastosMensais: exactCosts.gastosMensais,
        },
        source:
          financialCoverage.source === 'remote'
            ? ('network' as const)
            : financialCoverage.source === 'cache'
              ? ('cache' as const)
              : ('local' as const),
        financialCoverage,
      };
    })
    .finally(() => {
      if (allTimeInFlight.get(key) === operation) allTimeInFlight.delete(key);
    });
  allTimeInFlight.set(key, operation);
  return operation;
}

function coverageForAppData(result: FinancialAppDataLoadResult): FinancialDataCoverage {
  if (result.financialCoverage) return result.financialCoverage;
  return {
    remoteComplete: result.source === 'network' && !result.isStale,
    routesCoverage: 'local-only',
    source: result.source === 'network' ? 'remote' : result.source,
  };
}

function cacheCoverage(requestScopeKey?: string): FinancialDataCoverage {
  return {
    remoteComplete: false,
    routesCoverage: 'local-only',
    source: 'cache',
    ...(requestScopeKey ? { requestScopeKey } : {}),
  };
}

function coverageEqual(left: FinancialDataCoverage, right: FinancialDataCoverage): boolean {
  return (
    left.remoteComplete === right.remoteComplete &&
    left.routesCoverage === right.routesCoverage &&
    left.source === right.source &&
    left.requestScopeKey === right.requestScopeKey &&
    datasetCoverageEqual(left.costs, right.costs) &&
    datasetCoverageEqual(left.deliveries, right.deliveries)
  );
}

function datasetCoverageEqual(
  left: FinancialDatasetCoverage | undefined,
  right: FinancialDatasetCoverage | undefined,
): boolean {
  return (
    left === right ||
    (left !== undefined &&
      right !== undefined &&
      left.coverage === right.coverage &&
      left.fromCache === right.fromCache &&
      left.hasPendingWrites === right.hasPendingWrites &&
      left.origin === right.origin &&
      left.remoteConfirmed === right.remoteConfirmed &&
      left.scopeKey === right.scopeKey)
  );
}

function datasetCoverageForQuery<TScope>(
  provenance: FirestoreQueryProvenance<TScope> | undefined,
  kind: string,
  uid: string,
  sessionVersion: number,
  scope: TScope,
): FinancialDatasetCoverage {
  const expectedScopeKey = firestoreQueryScopeKey(kind, uid, sessionVersion, scope);
  const exactMatch = queryProvenanceMatches(provenance, kind, uid, sessionVersion, scope);
  if (!exactMatch || !provenance) {
    return {
      coverage: 'unknown',
      fromCache: null,
      hasPendingWrites: null,
      origin: 'unknown',
      remoteConfirmed: false,
      scopeKey: expectedScopeKey,
    };
  }
  return {
    coverage: provenance.coverage,
    fromCache: provenance.fromCache,
    hasPendingWrites: provenance.hasPendingWrites,
    origin: provenance.origin,
    remoteConfirmed: provenance.remoteConfirmed,
    scopeKey: provenance.scopeKey,
  };
}

function queryProvenanceMatches<TScope>(
  provenance: FirestoreQueryProvenance<TScope> | undefined,
  kind: string,
  uid: string,
  sessionVersion: number,
  scope: TScope,
): boolean {
  return (
    provenance?.uid === uid &&
    provenance.sessionVersion === sessionVersion &&
    provenance.scopeKey === firestoreQueryScopeKey(kind, uid, sessionVersion, scope)
  );
}

function periodCoverage(
  requestScopeKey: string,
  costs: FinancialDatasetCoverage,
  deliveries: FinancialDatasetCoverage,
): FinancialDataCoverage {
  const remoteComplete =
    costs.remoteConfirmed &&
    deliveries.remoteConfirmed &&
    costs.coverage === 'complete' &&
    deliveries.coverage === 'complete' &&
    costs.fromCache === false &&
    deliveries.fromCache === false &&
    costs.hasPendingWrites === false &&
    deliveries.hasPendingWrites === false;
  const source: FinancialDataCoverage['source'] = remoteComplete
    ? 'remote'
    : costs.origin === 'cache' ||
        deliveries.origin === 'cache' ||
        costs.origin === 'local-pending' ||
        deliveries.origin === 'local-pending'
      ? 'cache'
      : costs.origin === 'unknown' && deliveries.origin === 'unknown'
        ? 'none'
        : 'local';
  return {
    costs,
    deliveries,
    remoteComplete,
    requestScopeKey,
    routesCoverage: 'not-loaded',
    source,
  };
}

function hasFinancialRecords(snapshot: UserDataSnapshot): boolean {
  return (
    snapshot.entregas.length > 0 ||
    Object.keys(snapshot.gastosDiarios).length > 0 ||
    Object.keys(snapshot.gastosMensais).length > 0
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
  const currentSessionScopeKey = userId ? `${userId}:${sessionVersion ?? 'none'}` : null;
  const enabled = options.enabled ?? true;
  const displayMonth = options.displayMonth;
  const skipRefreshWhenCached = options.skipRefreshWhenCached ?? false;
  const queryKey = JSON.stringify(query);
  const stableQuery = useMemo(() => JSON.parse(queryKey) as DailyMonthlyQuery, [queryKey]);
  const isAllTimeQuery = stableQuery.loadAll === true;
  const snapshotScopeKey = isAllTimeQuery ? 'all' : (displayMonth ?? queryKey);
  const requestScopeKey = JSON.stringify([
    userId ?? null,
    sessionVersion,
    stableQuery,
    deliveryFiltersForQuery(stableQuery) ?? null,
  ]);
  const sessionScopeKeyRef = useRef(currentSessionScopeKey);
  const requestScopeKeyRef = useRef(requestScopeKey);
  const loadVersion = useRef(0);
  const [currentLoadGeneration, setCurrentLoadGeneration] = useState(0);
  const lastAutomaticLoadKey = useRef<string | undefined>(undefined);
  const [, setPeriodInvalidationRevision] = useState(0);
  const currentPeriodCacheInvalidationVersion =
    userId && displayMonth
      ? financialPeriodSnapshotCache.getPeriodInvalidationVersion(userId, displayMonth)
      : undefined;
  useLayoutEffect(() => {
    sessionScopeKeyRef.current = currentSessionScopeKey;
  }, [currentSessionScopeKey]);
  useLayoutEffect(() => {
    requestScopeKeyRef.current = requestScopeKey;
  }, [requestScopeKey]);
  useLayoutEffect(() => {
    if (!enabled) {
      const invalidatedGeneration = ++loadVersion.current;
      setCurrentLoadGeneration(invalidatedGeneration);
    }
  }, [enabled]);
  useEffect(
    () => () => {
      loadVersion.current += 1;
    },
    [],
  );
  const initialCacheEntry =
    userId && displayMonth
      ? financialPeriodSnapshotCache.getMemoryForRequest(
          userId,
          displayMonth,
          sessionVersion,
          requestScopeKey,
        )
      : null;
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
    requestScopeKey: hasInitialCachedSnapshot && !isAllTimeQuery ? requestScopeKey : undefined,
    sessionScopeKey: hasInitialCachedSnapshot ? currentSessionScopeKey : undefined,
    cacheDisplayMonth: hasInitialCachedSnapshot && !isAllTimeQuery ? displayMonth : undefined,
    cacheInvalidationVersion:
      hasInitialCachedSnapshot && !isAllTimeQuery
        ? currentPeriodCacheInvalidationVersion
        : undefined,
    coverage: hasInitialCachedSnapshot ? cacheCoverage(requestScopeKey) : EMPTY_COVERAGE,
  }));
  const [loading, setLoading] = useState(!hasInitialCachedSnapshot);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [confirmedDeliveryPreviewState, setConfirmedDeliveryPreviewState] =
    useState<ConfirmedDeliveryPreview | null>(null);
  const snapshotRef = useRef<UserDataSnapshot | null>(
    hasInitialCachedSnapshot ? initialCachedSnapshot : null,
  );
  const snapshotScopeRef = useRef<string | undefined>(
    hasInitialCachedSnapshot ? snapshotScopeKey : undefined,
  );
  const snapshotRequestScopeRef = useRef<string | undefined>(undefined);
  const {
    comparisonSnapshot,
    coverage,
    requestScopeKey: resolvedRequestScopeKey,
    sessionScopeKey: resolvedSnapshotSessionScopeKey,
    scopeKey: resolvedSnapshotScopeKey,
    snapshot,
    cacheDisplayMonth: resolvedSnapshotCacheDisplayMonth,
    cacheInvalidationVersion: resolvedSnapshotCacheInvalidationVersion,
  } = resolvedSnapshot;
  const resolvedSnapshotCacheVersionIsCurrent =
    resolvedSnapshotCacheDisplayMonth === undefined ||
    (userId !== undefined &&
      resolvedSnapshotCacheInvalidationVersion ===
        financialPeriodSnapshotCache.getPeriodInvalidationVersion(
          userId,
          resolvedSnapshotCacheDisplayMonth,
        ));
  const hasSnapshotForRequestedScope =
    snapshot !== null &&
    resolvedSnapshotCacheVersionIsCurrent &&
    resolvedSnapshotScopeKey === snapshotScopeKey &&
    resolvedSnapshotSessionScopeKey === currentSessionScopeKey &&
    (resolvedRequestScopeKey === undefined || resolvedRequestScopeKey === requestScopeKey);
  const resolvedRequestMatches =
    resolvedRequestScopeKey === undefined || resolvedRequestScopeKey === requestScopeKey;
  const keepPreviousScopeSnapshot =
    resolvedSnapshotCacheVersionIsCurrent &&
    resolvedSnapshotSessionScopeKey === currentSessionScopeKey &&
    (resolvedSnapshotScopeKey !== snapshotScopeKey || resolvedRequestMatches);
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
        : keepPreviousScopeSnapshot
          ? snapshot
          : null;
  const visibleComparisonSnapshot = hasSnapshotForRequestedScope
    ? comparisonSnapshot
    : hasCachedSnapshotForRequestedScope
      ? (initialCacheEntry?.comparisonSnapshot ?? null)
      : hasLocallyDerivedSnapshot
        ? locallyDerivedSnapshot.comparisonSnapshot
        : keepPreviousScopeSnapshot
          ? comparisonSnapshot
          : null;
  const visibleCoverage = hasSnapshotForRequestedScope
    ? coverage
    : hasCachedSnapshotForRequestedScope || hasLocallyDerivedSnapshot
      ? cacheCoverage()
      : coverage;
  const visibleSnapshotScopeKey = hasCachedSnapshotForRequestedScope
    ? snapshotScopeKey
    : hasLocallyDerivedSnapshot
      ? snapshotScopeKey
      : keepPreviousScopeSnapshot
        ? resolvedSnapshotScopeKey
        : undefined;
  const visibleSnapshotSessionScopeKey =
    hasSnapshotForRequestedScope || hasCachedSnapshotForRequestedScope || hasLocallyDerivedSnapshot
      ? currentSessionScopeKey
      : keepPreviousScopeSnapshot
        ? resolvedSnapshotSessionScopeKey
        : undefined;
  const visibleLoading = hasCachedSnapshotForRequestedScope
    ? false
    : hasLocallyDerivedSnapshot
      ? false
      : visibleSnapshot === null ||
          resolvedSnapshotScopeKey !== snapshotScopeKey ||
          resolvedSnapshotSessionScopeKey !== currentSessionScopeKey ||
          !resolvedRequestMatches
        ? error === undefined
        : loading;
  const visibleRefreshing =
    hasCachedSnapshotForRequestedScope || !enabled
      ? false
      : hasLocallyDerivedSnapshot
        ? true
        : refreshing;
  const load = useCallback(
    async (isRefresh = false) => {
      const periodCacheInvalidationVersion =
        userId && displayMonth
          ? financialPeriodSnapshotCache.getPeriodInvalidationVersion(userId, displayMonth)
          : undefined;
      const version = ++loadVersion.current;
      setCurrentLoadGeneration(version);
      const isCurrent = () =>
        loadVersion.current === version &&
        sessionScopeKeyRef.current === currentSessionScopeKey &&
        requestScopeKeyRef.current === requestScopeKey &&
        (periodCacheInvalidationVersion === undefined ||
          (userId !== undefined &&
            displayMonth !== undefined &&
            financialPeriodSnapshotCache.getPeriodInvalidationVersion(userId, displayMonth) ===
              periodCacheInvalidationVersion)) &&
        (!userId || isActiveAuthSession(userId, sessionVersion));
      if (!userId) {
        if (isCurrent()) setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else if (snapshotRef.current === null || snapshotScopeRef.current !== snapshotScopeKey) {
        setLoading(true);
      }
      setConfirmedDeliveryPreviewState(null);
      setError(undefined);

      try {
        const cachedEntryPromise = displayMonth
          ? Promise.resolve(
              financialPeriodSnapshotCache.getMemoryForRequest(
                userId,
                displayMonth,
                sessionVersion,
                requestScopeKey,
              ),
            )
          : Promise.resolve(null);
        const allTimeCacheEntryPromise = isAllTimeQuery
          ? financialPeriodSnapshotCache.readAllTime(userId, sessionVersion)
          : Promise.resolve(null);
        const baseSnapshotPromise: Promise<FinancialAppDataLoadResult> = isAllTimeQuery
          ? loadAllTimeAppData(userId, sessionVersion)
          : loadAppData(userId).then((snapshot) => ({
              isStale: true,
              snapshot,
              source: 'local',
            }));
        const deliveryFilters = deliveryFiltersForQuery(stableQuery);
        const expectedDeliveryFilters = deliveryFilters ?? { mode: 'all' as const };
        const awaitingRemoteDeliveries =
          ENABLE_FIRESTORE_CLIENTS_DELIVERIES && deliveryFilters !== undefined;
        const deliveryLoadPromise = awaitingRemoteDeliveries
          ? firestoreDeliveryDataSource
              .loadWithMetadata(userId, deliveryFilters, {}, sessionVersion)
              .then(
                (result) => {
                  const deliveryCoverage = datasetCoverageForQuery(
                    result.provenance,
                    'deliveries',
                    userId,
                    sessionVersion,
                    expectedDeliveryFilters,
                  );
                  if (
                    !isAllTimeQuery &&
                    displayMonth &&
                    isCurrent() &&
                    deliveryCoverage.remoteConfirmed &&
                    deliveryCoverage.coverage === 'complete' &&
                    deliveryCoverage.fromCache === false &&
                    deliveryCoverage.hasPendingWrites === false
                  ) {
                    setConfirmedDeliveryPreviewState({
                      cacheInvalidationVersion: periodCacheInvalidationVersion ?? -1,
                      deliveries: result.querySnapshot,
                      displayMonth,
                      loadVersion: version,
                      requestScopeKey,
                      sessionScopeKey: currentSessionScopeKey ?? '',
                      uid: userId,
                    });
                  }
                  return { status: 'loaded' as const, result };
                },
                (error: unknown) => ({ status: 'failed' as const, error }),
              )
          : Promise.resolve({ status: 'skipped' as const });
        const costsLoadPromise =
          ENABLE_FIRESTORE_DAILY_MONTHLY && !isAllTimeQuery
            ? firestoreDailyMonthlyDataSource
                .loadWithMetadata(userId, stableQuery, { canRun: isCurrent, sessionVersion })
                .then(
                  (costs) => ({ status: 'loaded' as const, costs }),
                  (error: unknown) => ({ status: 'failed' as const, error }),
                )
            : Promise.resolve({ status: 'skipped' as const });
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
            sessionScopeKey: currentSessionScopeKey,
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
              coverage: cacheCoverage(requestScopeKey),
              requestScopeKey,
              scopeKey: snapshotScopeKey,
              sessionScopeKey: currentSessionScopeKey,
              cacheDisplayMonth: displayMonth,
              cacheInvalidationVersion: periodCacheInvalidationVersion,
              snapshot: cachedSnapshot,
            });
            setLoading(false);
            setRefreshing(true);
          }
        }

        const [baseData, deliveryResult, costsResult] = await Promise.all([
          baseSnapshotPromise,
          deliveryLoadPromise,
          costsLoadPromise,
        ]);
        if (!isCurrent()) return;
        const baseSnapshot = baseData.snapshot;

        const localSnapshot = scopeSnapshotToQuery(baseSnapshot, stableQuery, deliveryFilters);
        let latestSourceSnapshot = localSnapshot;
        let periodDataCoverage: FinancialDataCoverage = coverageForAppData(baseData);
        let remoteDataComplete = isAllTimeQuery
          ? coverageForAppData(baseData).remoteComplete
          : false;
        const publishSnapshot = (
          sourceSnapshot: UserDataSnapshot,
          dataCoverage: FinancialDataCoverage,
        ) => {
          latestSourceSnapshot = sourceSnapshot;
          const visibleSnapshot = scopeSnapshotToDisplayMonth(sourceSnapshot, displayMonth);
          snapshotRef.current = visibleSnapshot;
          snapshotScopeRef.current = snapshotScopeKey;
          snapshotRequestScopeRef.current = requestScopeKey;
          setResolvedSnapshot((current) => {
            const nextComparisonSnapshot =
              current.comparisonSnapshot &&
              current.sessionScopeKey === currentSessionScopeKey &&
              snapshotsEquivalent(current.comparisonSnapshot, sourceSnapshot)
                ? current.comparisonSnapshot
                : sourceSnapshot;
            const nextSnapshot =
              current.snapshot && snapshotsEquivalent(current.snapshot, visibleSnapshot)
                ? current.snapshot
                : visibleSnapshot;
            const nextCoverage = dataCoverage;
            if (
              current.comparisonSnapshot === nextComparisonSnapshot &&
              current.scopeKey === snapshotScopeKey &&
              current.requestScopeKey === requestScopeKey &&
              current.sessionScopeKey === currentSessionScopeKey &&
              current.snapshot === nextSnapshot &&
              coverageEqual(current.coverage, nextCoverage) &&
              current.cacheDisplayMonth === displayMonth &&
              current.cacheInvalidationVersion === periodCacheInvalidationVersion
            ) {
              return current;
            }
            return {
              comparisonSnapshot: nextComparisonSnapshot,
              coverage: nextCoverage,
              requestScopeKey,
              scopeKey: snapshotScopeKey,
              sessionScopeKey: currentSessionScopeKey,
              cacheDisplayMonth: displayMonth,
              cacheInvalidationVersion: periodCacheInvalidationVersion,
              snapshot: nextSnapshot,
            };
          });
        };
        const deliveryResultIsExact =
          deliveryResult.status === 'loaded' &&
          queryProvenanceMatches(
            deliveryResult.result.provenance,
            'deliveries',
            userId,
            sessionVersion,
            expectedDeliveryFilters,
          );
        const costsResultIsExact =
          costsResult.status === 'loaded' &&
          queryProvenanceMatches(
            costsResult.costs.provenance,
            'daily-monthly-costs',
            userId,
            sessionVersion,
            stableQuery,
          );
        const deliveryCoverage = datasetCoverageForQuery(
          deliveryResultIsExact && deliveryResult.status === 'loaded'
            ? deliveryResult.result.provenance
            : undefined,
          'deliveries',
          userId,
          sessionVersion,
          expectedDeliveryFilters,
        );
        const costsCoverage = datasetCoverageForQuery(
          costsResultIsExact && costsResult.status === 'loaded'
            ? costsResult.costs.provenance
            : undefined,
          'daily-monthly-costs',
          userId,
          sessionVersion,
          stableQuery,
        );
        periodDataCoverage = periodCoverage(requestScopeKey, costsCoverage, deliveryCoverage);
        remoteDataComplete = isAllTimeQuery
          ? coverageForAppData(baseData).remoteComplete
          : periodDataCoverage.remoteComplete;

        if (deliveryResultIsExact && deliveryResult.status === 'loaded') {
          const exactDeliveries = deliveryResult.result.querySnapshot;
          if (deliveryCoverage.remoteConfirmed || exactDeliveries.length > 0) {
            latestSourceSnapshot = { ...latestSourceSnapshot, entregas: exactDeliveries };
          }
        } else if (deliveryResult.status === 'failed') {
          if (__DEV__)
            console.warn(
              '[useFinancialData] Firestore deliveries fallback local.',
              deliveryResult.error,
            );
        }

        if (costsResultIsExact && costsResult.status === 'loaded') {
          const exactCosts = costsResult.costs.querySnapshot;
          if (
            costsCoverage.remoteConfirmed ||
            Object.keys(exactCosts.gastosDiarios).length > 0 ||
            Object.keys(exactCosts.gastosMensais).length > 0
          ) {
            latestSourceSnapshot = {
              ...latestSourceSnapshot,
              gastosDiarios: exactCosts.gastosDiarios,
              gastosMensais: exactCosts.gastosMensais,
            };
          }
        } else if (costsResult.status === 'failed') {
          if (__DEV__)
            console.warn('[useFinancialData] Firestore fallback local.', costsResult.error);
        }

        if (
          !remoteDataComplete &&
          periodDataCoverage.source === 'none' &&
          hasFinancialRecords(latestSourceSnapshot)
        ) {
          periodDataCoverage = { ...periodDataCoverage, source: 'local' };
        }

        if (isCurrent()) {
          rememberBaseSnapshot(userId, sessionVersion, baseSnapshot, {
            allTimeCoverage: isAllTimeQuery && remoteDataComplete,
            costsComplete: isAllTimeQuery ? false : costsCoverage.remoteConfirmed,
            deliveriesComplete: isAllTimeQuery ? false : deliveryCoverage.remoteConfirmed,
            isAllTimeQuery,
            query: stableQuery,
            remoteComplete: isAllTimeQuery ? remoteDataComplete : false,
            source: isAllTimeQuery ? baseData.source : 'local',
            sourceSnapshot: latestSourceSnapshot,
          });

          const hasExistingSnapshotForScope =
            snapshotRef.current !== null &&
            snapshotScopeRef.current === snapshotScopeKey &&
            (snapshotRequestScopeRef.current === undefined ||
              snapshotRequestScopeRef.current === requestScopeKey);
          const canPublishUnconfirmedData = hasFinancialRecords(latestSourceSnapshot);
          if (remoteDataComplete || (!hasExistingSnapshotForScope && canPublishUnconfirmedData)) {
            const visibleCoverage = isAllTimeQuery
              ? coverageForAppData(baseData)
              : periodDataCoverage;
            publishSnapshot(latestSourceSnapshot, visibleCoverage);
          }

          if (!remoteDataComplete) {
            setError(
              isAllTimeQuery
                ? 'Os dados completos do histórico ainda não têm confirmação remota suficiente.'
                : 'A cobertura remota completa deste período ainda não foi confirmada; os dados locais ou em cache são provisórios.',
            );
          }
          if (displayMonth && remoteDataComplete) {
            const visibleSnapshot = scopeSnapshotToDisplayMonth(latestSourceSnapshot, displayMonth);
            void financialPeriodSnapshotCache
              .write(
                userId,
                displayMonth,
                visibleSnapshot,
                latestSourceSnapshot,
                sessionVersion,
                requestScopeKey,
              )
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
    [
      currentSessionScopeKey,
      displayMonth,
      isAllTimeQuery,
      requestScopeKey,
      setCurrentLoadGeneration,
      sessionVersion,
      snapshotScopeKey,
      stableQuery,
      userId,
    ],
  );

  useEffect(() => {
    if (!enabled) {
      lastAutomaticLoadKey.current = undefined;
      return;
    }
    const automaticLoadKey = `${currentSessionScopeKey ?? 'signed-out'}:${snapshotScopeKey}:${queryKey}`;
    if (lastAutomaticLoadKey.current === automaticLoadKey) return;
    lastAutomaticLoadKey.current = automaticLoadKey;
    if (skipRefreshWhenCached && (hasInitialCachedSnapshot || hasLocallyDerivedSnapshot)) return;
    void (async () => {
      await load();
    })();
  }, [
    currentSessionScopeKey,
    enabled,
    hasInitialCachedSnapshot,
    hasLocallyDerivedSnapshot,
    load,
    queryKey,
    skipRefreshWhenCached,
    snapshotScopeKey,
  ]);

  useEffect(() => {
    if (!userId) return undefined;
    return financialPeriodSnapshotCache.subscribeToPeriodInvalidation(
      userId,
      (invalidatedMonth) => {
        setPeriodInvalidationRevision((revision) => revision + 1);
        if (invalidatedMonth !== displayMonth) return;

        const invalidatedGeneration = ++loadVersion.current;
        setCurrentLoadGeneration(invalidatedGeneration);
        setConfirmedDeliveryPreviewState(null);
        snapshotRef.current = null;
        snapshotScopeRef.current = undefined;
        snapshotRequestScopeRef.current = undefined;
        setLoading(false);
        setRefreshing(false);
        setError('Os dados confirmados deste período foram invalidados e aguardam nova leitura.');
      },
    );
  }, [displayMonth, userId]);

  useEffect(() => {
    if (!enabled || !userId) return undefined;
    return financialPeriodSnapshotCache.subscribeToExternalChange(userId, () => {
      void load(true);
    });
  }, [enabled, load, userId]);

  const reload = useCallback(() => load(true), [load]);
  const hasPreviouslyConfirmedSnapshot =
    visibleSnapshot !== null &&
    (visibleCoverage.remoteComplete ||
      (hasSnapshotForRequestedScope &&
        initialCacheEntry !== null &&
        snapshotsEquivalent(initialCacheEntry.snapshot, visibleSnapshot)) ||
      (isAllTimeQuery && hasSnapshotForRequestedScope && initialAllTimeCacheEntry !== null));
  const confirmedDeliveryPreview =
    enabled &&
    userId !== undefined &&
    displayMonth !== undefined &&
    confirmedDeliveryPreviewState?.uid === userId &&
    confirmedDeliveryPreviewState.sessionScopeKey === currentSessionScopeKey &&
    confirmedDeliveryPreviewState.displayMonth === displayMonth &&
    confirmedDeliveryPreviewState.requestScopeKey === requestScopeKey &&
    confirmedDeliveryPreviewState.loadVersion === currentLoadGeneration &&
    confirmedDeliveryPreviewState.cacheInvalidationVersion ===
      currentPeriodCacheInvalidationVersion &&
    isActiveAuthSession(userId, sessionVersion)
      ? confirmedDeliveryPreviewState.deliveries
      : null;

  return {
    snapshot: visibleSnapshot,
    comparisonSnapshot: visibleComparisonSnapshot,
    coverage: visibleCoverage,
    remoteComplete: visibleCoverage.remoteComplete,
    requestScopeKey,
    routesCoverage: visibleCoverage.routesCoverage,
    snapshotScopeKey: visibleSnapshotScopeKey,
    snapshotSessionScopeKey: visibleSnapshotSessionScopeKey,
    hasPreviouslyConfirmedSnapshot,
    confirmedDeliveryPreview,
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
