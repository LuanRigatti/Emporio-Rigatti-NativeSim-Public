import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/providers';
import {
  retailOrderDataSource,
  retailOrderHistoryFinancialSummaryService,
  type RetailOrderHistoryFinancialState,
  type RetailOrderLoadState,
} from '@/services/retail-orders';
import type { RetailOrder } from '@/types/data';

export type RetailOrderHistoryFinancialViewState =
  { status: 'loading' } | RetailOrderHistoryFinancialState;

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
) {
  const { sessionVersion, user } = useAuth();
  const userId = user?.id;
  const [states, setStates] = useState<Record<string, RetailOrderHistoryFinancialViewState>>({});
  const requestGeneration = useRef(0);
  const orderKey = useMemo(
    () =>
      orders
        .map((order) =>
          [
            order.orderId,
            order.orderDate,
            order.status,
            order.subtotalProducts,
            order.discount,
            order.deliveryFee,
            order.deliveryCost,
          ].join('|'),
        )
        .join('::'),
    [orders],
  );

  useEffect(() => {
    const generation = ++requestGeneration.current;
    if (!userId || orders.length === 0) {
      // The returned map is filtered by the current order set; no stale order can render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStates({});
      return undefined;
    }

    if (refreshKey > 0) {
      retailOrderHistoryFinancialSummaryService.clear(userId, sessionVersion);
    }
    setStates(
      Object.fromEntries(orders.map((order) => [order.orderId, { status: 'loading' as const }])),
    );
    let active = true;
    void retailOrderHistoryFinancialSummaryService
      .loadForOrders(orders, userId, sessionVersion)
      .then((results) => {
        if (!active || requestGeneration.current !== generation) return;
        setStates(Object.fromEntries(results.entries()));
      });

    return () => {
      active = false;
    };
  }, [orderKey, orders, refreshKey, sessionVersion, userId]);

  return states;
}
