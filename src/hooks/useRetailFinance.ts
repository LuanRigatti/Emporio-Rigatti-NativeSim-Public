import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import { useAuth } from '@/providers';
import {
  buildRetailFinanceCategoryOptions,
  retailFinanceAggregationService,
  type RetailFinancePeriod,
  type RetailFinanceSummary,
  type RetailFinanceView,
} from '@/services/retail-finance';
import {
  retailFinanceDatasetService,
  type RetailFinanceDatasetState,
} from '@/services/retail-finance/RetailFinanceDatasetService';
import type { RetailCategory } from '@/types/data';

const summaryCache = new Map<string, RetailFinanceSummary>();

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
  const summaryKey = `${scopeKey}:${period.startDate}:${period.endDate}:${view}`;
  const normalizedPeriod = useMemo(
    () => ({ endDate: period.endDate, startDate: period.startDate }),
    [period.endDate, period.startDate],
  );
  const getDatasetSnapshot = useCallback(
    (): RetailFinanceDatasetState =>
      retailFinanceDatasetService.getSnapshot(userId, sessionVersion),
    [sessionVersion, userId],
  );
  const datasetState = useSyncExternalStore(
    retailFinanceDatasetService.subscribe,
    getDatasetSnapshot,
    getDatasetSnapshot,
  );

  useEffect(() => {
    if (!enabled || !userId) return undefined;
    void retailFinanceDatasetService.load(userId, sessionVersion).catch(() => undefined);
    return undefined;
  }, [enabled, sessionVersion, userId]);

  const summary = useMemo(() => {
    if (!userId) return null;
    if (!datasetState.dataset) return summaryCache.get(summaryKey) ?? null;
    const next = retailFinanceAggregationService.aggregate(
      datasetState.dataset.orders,
      datasetState.dataset.paymentsByOrderId,
      normalizedPeriod,
      view,
    );
    summaryCache.set(summaryKey, next);
    return next;
  }, [datasetState.dataset, normalizedPeriod, summaryKey, userId, view]);

  const reload = useCallback(() => {
    if (!userId) return;
    void retailFinanceDatasetService.reload(userId, sessionVersion).catch(() => undefined);
  }, [sessionVersion, userId]);

  const categoryOptions = buildRetailFinanceCategoryOptions(
    categories,
    datasetState.dataset?.orders ?? [],
  );

  return useMemo(
    () => ({
      categoryOptions,
      error: datasetState.error,
      loading: Boolean(
        enabled && userId && !datasetState.dataset && !summary && !datasetState.error,
      ),
      refreshing: Boolean((datasetState.dataset || summary) && datasetState.refreshing),
      reload,
      summary,
    }),
    [
      categoryOptions,
      datasetState.dataset,
      datasetState.error,
      datasetState.refreshing,
      enabled,
      reload,
      summary,
      userId,
    ],
  );
}
