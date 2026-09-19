import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/providers';
import {
  buildRetailFinanceCategoryOptions,
  retailFinanceAggregationService,
  type RetailFinancePeriod,
  type RetailFinanceSummary,
  type RetailFinanceView,
} from '@/services/retail-finance';
import {
  getRetailOrderHistoryFinancialSignature,
  retailOrderDataSource,
  retailPaymentDataSource,
} from '@/services/retail-orders';
import type { RetailCategory, RetailOrder, RetailPayment } from '@/types/data';

type RetailFinanceDataset = {
  orders: readonly RetailOrder[];
  ordersSignature: string;
  paymentsByOrderId: ReadonlyMap<string, readonly RetailPayment[]>;
};

type RetailFinanceState = {
  error?: string;
  loading: boolean;
  refreshing: boolean;
  summary: RetailFinanceSummary | null;
};

const datasetCache = new Map<string, RetailFinanceDataset>();
const summaryCache = new Map<string, RetailFinanceSummary>();
const inFlightLoads = new Map<string, Promise<void>>();

function ordersSignature(orders: readonly RetailOrder[]): string {
  return orders
    .map((order) =>
      [
        getRetailOrderHistoryFinancialSignature(order),
        order.status,
        order.lineItems
          .map((lineItem) =>
            [
              lineItem.categoryIdSnapshot,
              lineItem.categorySnapshot,
              lineItem.financeGroupSnapshot ?? '',
            ].join('|'),
          )
          .join(','),
      ].join('~'),
    )
    .sort()
    .join('::');
}

async function loadPaymentSnapshots(
  orders: readonly RetailOrder[],
  userId: string,
  sessionVersion: number | undefined,
  remote: boolean,
): Promise<ReadonlyMap<string, readonly RetailPayment[]>> {
  const next = new Map<string, readonly RetailPayment[]>();
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < orders.length) {
      const order = orders[nextIndex];
      nextIndex += 1;
      if (!order) continue;
      if (remote) {
        await retailPaymentDataSource.load(order.orderId, userId, sessionVersion);
      } else {
        await retailPaymentDataSource.hydrateFromCache(order.orderId, userId, sessionVersion);
      }
      next.set(order.orderId, retailPaymentDataSource.list(order.orderId, userId, sessionVersion));
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(2, Math.max(1, orders.length)) }, () => worker()),
  );
  return next;
}

async function loadDataset(
  scopeKey: string,
  userId: string,
  sessionVersion: number | undefined,
  publish: (dataset: RetailFinanceDataset) => void,
  force = false,
): Promise<void> {
  const existing = inFlightLoads.get(scopeKey);
  if (existing) return existing;
  if (!force && datasetCache.has(scopeKey)) return;

  const operation = (async () => {
    await retailOrderDataSource.hydrateFromCache(userId, sessionVersion);
    const cachedOrders = retailOrderDataSource.list(
      { includeCancelled: true },
      userId,
      sessionVersion,
    );
    if (cachedOrders.length) {
      const cachedDataset: RetailFinanceDataset = {
        orders: cachedOrders,
        ordersSignature: ordersSignature(cachedOrders),
        paymentsByOrderId: await loadPaymentSnapshots(cachedOrders, userId, sessionVersion, false),
      };
      datasetCache.set(scopeKey, cachedDataset);
      publish(cachedDataset);
    }

    await retailOrderDataSource.loadHistorical(userId, sessionVersion);
    const orders = retailOrderDataSource.list({ includeCancelled: true }, userId, sessionVersion);
    const dataset: RetailFinanceDataset = {
      orders,
      ordersSignature: ordersSignature(orders),
      paymentsByOrderId: await loadPaymentSnapshots(orders, userId, sessionVersion, true),
    };
    datasetCache.set(scopeKey, dataset);
    publish(dataset);
  })();
  inFlightLoads.set(scopeKey, operation);
  try {
    await operation;
  } finally {
    if (inFlightLoads.get(scopeKey) === operation) inFlightLoads.delete(scopeKey);
  }
}

export function useRetailFinance(
  period: RetailFinancePeriod,
  view: RetailFinanceView,
  options: { categories?: readonly RetailCategory[]; enabled?: boolean } = {},
) {
  const { sessionVersion, user } = useAuth();
  const userId = user?.id;
  const enabled = options.enabled ?? true;
  const categories = options.categories ?? [];
  const scopeKey = `${userId ?? 'none'}:${sessionVersion ?? 'none'}`;
  const periodKey = `${period.startDate}:${period.endDate}`;
  const normalizedPeriod = useMemo(
    () => ({ endDate: period.endDate, startDate: period.startDate }),
    [period.endDate, period.startDate],
  );
  const summaryKey = `${scopeKey}:${periodKey}:${view}`;
  const [state, setState] = useState<RetailFinanceState>({
    loading: Boolean(userId && enabled),
    refreshing: false,
    summary: null,
  });
  const [datasetRevision, setDatasetRevision] = useState(0);
  const requestGeneration = useRef(0);
  const getOrdersSnapshot = useCallback(
    () => retailOrderDataSource.getSnapshot(userId, sessionVersion),
    [sessionVersion, userId],
  );
  const ordersSnapshot = useSyncExternalStore(
    retailOrderDataSource.subscribe,
    getOrdersSnapshot,
    getOrdersSnapshot,
  );

  useEffect(() => {
    let active = true;
    return retailPaymentDataSource.subscribe(() => {
      if (!active) return;
      const current = datasetCache.get(scopeKey);
      if (!current) return;
      const paymentsByOrderId = new Map(current.paymentsByOrderId);
      current.orders.forEach((order) => {
        const snapshot = retailPaymentDataSource.getSnapshot(order.orderId, userId, sessionVersion);
        if (snapshot !== null) paymentsByOrderId.set(order.orderId, snapshot);
      });
      const next = { ...current, paymentsByOrderId };
      datasetCache.set(scopeKey, next);
      setDatasetRevision((value) => value + 1);
    });
  }, [scopeKey, sessionVersion, userId]);

  /* eslint-disable react-hooks/set-state-in-effect -- synchronizes the external order cache and session state. */
  useEffect(() => {
    const currentOrders = ordersSnapshot
      ? retailOrderDataSource.list({ includeCancelled: true }, userId, sessionVersion)
      : [];
    const current = datasetCache.get(scopeKey);
    if (!current || current.ordersSignature === ordersSignature(currentOrders)) return;
    const next = {
      ...current,
      orders: currentOrders,
      ordersSignature: ordersSignature(currentOrders),
    };
    datasetCache.set(scopeKey, next);
    setDatasetRevision((value) => value + 1);
  }, [ordersSnapshot, scopeKey, sessionVersion, userId]);

  useEffect(() => {
    const generation = ++requestGeneration.current;
    if (!enabled || !userId) {
      setState({ loading: false, refreshing: false, summary: null });
      return undefined;
    }
    const cachedSummary = summaryCache.get(summaryKey) ?? null;
    setState({
      loading: cachedSummary === null,
      refreshing: cachedSummary !== null,
      summary: cachedSummary,
    });
    const publish = (dataset: RetailFinanceDataset) => {
      if (requestGeneration.current !== generation) return;
      const summary = retailFinanceAggregationService.aggregate(
        dataset.orders,
        dataset.paymentsByOrderId,
        normalizedPeriod,
        view,
      );
      summaryCache.set(summaryKey, summary);
      setState({ loading: false, refreshing: true, summary });
    };
    const current = datasetCache.get(scopeKey);
    if (current) publish(current);

    void loadDataset(scopeKey, userId, sessionVersion, publish).then(
      () => {
        if (requestGeneration.current !== generation) return;
        const dataset = datasetCache.get(scopeKey);
        if (!dataset) {
          setState((previous) => ({ ...previous, loading: false, refreshing: false }));
          return;
        }
        const summary = retailFinanceAggregationService.aggregate(
          dataset.orders,
          dataset.paymentsByOrderId,
          normalizedPeriod,
          view,
        );
        summaryCache.set(summaryKey, summary);
        setState({ loading: false, refreshing: false, summary });
      },
      (error: unknown) => {
        if (requestGeneration.current !== generation) return;
        setState((previous) => ({
          error:
            error instanceof Error ? error.message : 'Não foi possível carregar Finanças Varejo.',
          loading: false,
          refreshing: false,
          summary: previous.summary,
        }));
      },
    );
    return undefined;
  }, [
    datasetRevision,
    enabled,
    normalizedPeriod,
    scopeKey,
    sessionVersion,
    summaryKey,
    userId,
    view,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const reload = useCallback(() => {
    if (!userId) return;
    datasetCache.delete(scopeKey);
    setDatasetRevision((value) => value + 1);
    void loadDataset(
      scopeKey,
      userId,
      sessionVersion,
      () => setDatasetRevision((value) => value + 1),
      true,
    );
  }, [scopeKey, sessionVersion, userId]);

  const categoryOptions = buildRetailFinanceCategoryOptions(
    categories,
    datasetCache.get(scopeKey)?.orders ?? [],
  );

  return useMemo(
    () => ({
      categoryOptions,
      error: state.error,
      loading: state.loading,
      refreshing: state.refreshing,
      reload,
      summary: state.summary,
    }),
    [categoryOptions, reload, state.error, state.loading, state.refreshing, state.summary],
  );
}
