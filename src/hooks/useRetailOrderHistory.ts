import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/providers';
import {
  getHistoryMonthRange,
  getHistoryWeekRange,
} from '@/features/history/utils/historyPeriodUtils';
import {
  getRetailOrderHistoryFinancialSignature,
  retailOrderDataSource,
  retailOrderHistoryFinancialSummaryService,
  type RetailOrderHistoryFinancialState,
  type RetailOrderLoadState,
} from '@/services/retail-orders';
import type { RetailOrder, RetailOrderFinancialSummary } from '@/types/data';

import { filterRetailOrdersByOrderDate } from '@/features/retail-orders/utils/retailOrderHistoryUtils';

export type RetailOrderHistoryFinancialViewState =
  | { status: 'loading' }
  | {
      status: 'ready';
      summary: RetailOrderFinancialSummary;
      revalidating?: boolean;
      revalidationError?: string;
    }
  | Extract<RetailOrderHistoryFinancialState, { status: 'error' }>;

export function getRetailOrderHistoryFinancialCandidateOrders(
  orders: readonly RetailOrder[],
  selectedDate: string,
): readonly RetailOrder[] {
  const ranges = [
    { endDate: selectedDate, startDate: selectedDate },
    getHistoryWeekRange(selectedDate),
    getHistoryMonthRange(selectedDate),
  ];
  const candidates = new Map<string, RetailOrder>();

  ranges.forEach((range) => {
    filterRetailOrdersByOrderDate(orders, range).forEach((order) => {
      candidates.set(order.orderId, order);
    });
  });

  return [...candidates.values()];
}

export function useRetailOrderHistory() {
  const { sessionVersion, status: authStatus, user } = useAuth();
  const userId = user?.id;
  const [refreshKey, setRefreshKey] = useState(0);
  const getSnapshot = useCallback(
    () => retailOrderDataSource.getSnapshot(userId, sessionVersion),
    [sessionVersion, userId],
  );
  const snapshot = useSyncExternalStore(retailOrderDataSource.subscribe, getSnapshot, getSnapshot);
  const getLoadState = useCallback(
    (): RetailOrderLoadState => retailOrderDataSource.getLoadState(userId, sessionVersion),
    [sessionVersion, userId],
  );
  const loadState = useSyncExternalStore(
    retailOrderDataSource.subscribe,
    getLoadState,
    getLoadState,
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (!userId) {
        if (authStatus !== 'loading') return;
        return;
      }
      if (isRefresh) setRefreshKey((value) => value + 1);
      try {
        await retailOrderDataSource.loadHistorical(userId, sessionVersion);
      } catch {
        // The data source publishes the revalidation error for the screen.
      }
    },
    [authStatus, sessionVersion, userId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const orders = useMemo(
    () =>
      snapshot
        ? retailOrderDataSource.list({ includeCancelled: true }, userId, sessionVersion)
        : [],
    [sessionVersion, snapshot, userId],
  );
  const reload = useCallback(() => load(true), [load]);

  return {
    cacheAvailable: loadState.source === 'cache' || loadState.source === 'local',
    error: loadState.error,
    loading: Boolean(userId) && !snapshot && !loadState.error && !loadState.remoteComplete,
    orders,
    refreshing: loadState.revalidating && Boolean(snapshot),
    reload,
    remoteComplete: loadState.remoteComplete,
    refreshKey,
    snapshot,
  };
}

export function useRetailOrderHistoryFinancialSummaries(
  orders: readonly RetailOrder[],
  refreshKey = 0,
  candidateOrders?: readonly RetailOrder[],
) {
  const { sessionVersion, user } = useAuth();
  const userId = user?.id;
  const [stateStore, setStateStore] = useState<{
    scopeKey: string;
    states: Record<string, RetailOrderHistoryFinancialViewState>;
  }>({ scopeKey: `${userId ?? 'none'}:${sessionVersion ?? 'none'}`, states: {} });
  const requestGeneration = useRef(0);
  const stateSignatures = useRef(new Map<string, string>());
  const scopeKey = `${userId ?? 'none'}:${sessionVersion ?? 'none'}`;
  const previousRefreshKey = useRef(refreshKey);
  const orderKey = useMemo(
    () => orders.map(getRetailOrderHistoryFinancialSignature).sort().join('::'),
    [orders],
  );
  const candidateOrderKey = useMemo(
    () => candidateOrders?.map(getRetailOrderHistoryFinancialSignature).sort().join('::') ?? '',
    [candidateOrders],
  );
  const scopeChanged = stateStore.scopeKey !== scopeKey;

  useEffect(() => {
    if (!userId || !candidateOrders?.length) return;
    void retailOrderHistoryFinancialSummaryService.primeFromCache(
      candidateOrders,
      userId,
      sessionVersion,
    );
    // `candidateOrderKey` is the semantic dependency; array identity must not restart prewarm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateOrderKey, sessionVersion, userId]);

  useEffect(() => {
    const generation = ++requestGeneration.current;
    const isNewScope = stateStore.scopeKey !== scopeKey;
    if (isNewScope) {
      stateSignatures.current.clear();
    }

    const shouldRevalidate = !isNewScope && refreshKey !== previousRefreshKey.current;
    previousRefreshKey.current = refreshKey;
    if (!userId || orders.length === 0) {
      if (isNewScope) {
        // Clear the previous UID/session before rendering an empty scope.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStateStore(() => ({ scopeKey, states: {} }));
      }
      return undefined;
    }

    setStateStore((previousStore) => {
      const previous = isNewScope ? {} : previousStore.states;
      const next = { ...previous };
      orders.forEach((order) => {
        const signature = getRetailOrderHistoryFinancialSignature(order);
        const previousState = previous[order.orderId];
        const sameSignature = stateSignatures.current.get(order.orderId) === signature;
        stateSignatures.current.set(order.orderId, signature);

        if (sameSignature && previousState?.status === 'ready') {
          next[order.orderId] = {
            ...previousState,
            ...(shouldRevalidate ? { revalidating: true, revalidationError: undefined } : {}),
          };
          return;
        }

        if (sameSignature && previousState?.status === 'error' && !shouldRevalidate) {
          next[order.orderId] = previousState;
          return;
        }

        next[order.orderId] = { status: 'loading' };
      });
      return { scopeKey, states: next };
    });

    let active = true;
    void retailOrderHistoryFinancialSummaryService
      .loadForOrders(orders, userId, sessionVersion, {
        onCachedSummary: (orderId, summary, revalidating) => {
          if (!active || requestGeneration.current !== generation) return;
          setStateStore((previousStore) => {
            if (previousStore.scopeKey !== scopeKey) return previousStore;
            return {
              scopeKey,
              states: {
                ...previousStore.states,
                [orderId]: {
                  revalidating: revalidating || undefined,
                  status: 'ready',
                  summary,
                },
              },
            };
          });
        },
        revalidate: shouldRevalidate,
      })
      .then((results) => {
        if (!active || requestGeneration.current !== generation) return;
        setStateStore((previousStore) => {
          if (previousStore.scopeKey !== scopeKey) return previousStore;
          const previous = previousStore.states;
          const next = { ...previous };
          results.forEach((result, orderId) => {
            if (result.status === 'ready') {
              next[orderId] = { status: 'ready', summary: result.summary };
              return;
            }

            const previousState = previous[orderId];
            if (previousState?.status === 'ready') {
              next[orderId] = {
                ...previousState,
                revalidating: false,
                revalidationError: result.message,
              };
              return;
            }

            next[orderId] = { status: 'error', message: result.message };
          });
          return { scopeKey, states: next };
        });
      });

    return () => {
      active = false;
    };
    // `orderKey` is the semantic dependency; array identity must not restart this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey, refreshKey, scopeKey, sessionVersion, userId]);

  useEffect(() => {
    if (!userId) return undefined;
    return retailOrderHistoryFinancialSummaryService.subscribe(() => {
      setStateStore((previousStore) => {
        if (previousStore.scopeKey !== scopeKey) return previousStore;
        let changed = false;
        const next = { ...previousStore.states };
        orders.forEach((order) => {
          const summary = retailOrderHistoryFinancialSummaryService.getCachedSummary(
            order,
            userId,
            sessionVersion,
          );
          if (!summary) return;
          const previousState = next[order.orderId];
          if (
            previousState?.status === 'ready' &&
            previousState.summary === summary &&
            !previousState.revalidating &&
            !previousState.revalidationError
          ) {
            return;
          }
          next[order.orderId] = { status: 'ready', summary };
          changed = true;
        });
        return changed ? { scopeKey, states: next } : previousStore;
      });
    });
  }, [orders, scopeKey, sessionVersion, userId]);

  return useMemo(() => {
    if (scopeChanged || !userId) return {};
    const next = { ...stateStore.states };
    orders.forEach((order) => {
      const summary = retailOrderHistoryFinancialSummaryService.getCachedSummary(
        order,
        userId,
        sessionVersion,
      );
      if (!summary) return;
      const previousState = next[order.orderId];
      if (previousState?.status === 'ready' && previousState.summary === summary) return;
      next[order.orderId] = { status: 'ready', summary };
    });
    return next;
  }, [orders, scopeChanged, sessionVersion, stateStore.states, userId]);
}
