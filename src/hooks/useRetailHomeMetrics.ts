import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/providers';
import { retailOrderDataSource } from '@/services/retail-orders';
import { RETAIL_FINANCE_GENERAL_VIEW } from '@/services/retail-finance';
import { retailFinanceDatasetService } from '@/services/retail-finance/RetailFinanceDatasetService';
import { calculateRetailHomeReceivable } from '@/services/retail-finance/RetailHomeMetricsService';
import { useRetailFinance } from './useRetailFinance';
import { todayIso } from '@/utils/data';

export function useRetailHomeMetrics() {
  const { sessionVersion, user } = useAuth();
  const userId = user?.id;
  const [currentDate, setCurrentDate] = useState(() => todayIso());
  const finance = useRetailFinance(
    { endDate: currentDate, startDate: currentDate },
    RETAIL_FINANCE_GENERAL_VIEW,
  );
  const getDatasetSnapshot = useCallback(
    () => retailFinanceDatasetService.getSnapshot(userId, sessionVersion),
    [sessionVersion, userId],
  );
  const datasetState = useSyncExternalStore(
    retailFinanceDatasetService.subscribe,
    getDatasetSnapshot,
    getDatasetSnapshot,
  );

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(todayIso()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const receivable = useMemo(() => {
    if (!datasetState.dataset) return null;
    return calculateRetailHomeReceivable(datasetState.dataset);
  }, [datasetState.dataset]);

  const todayOrders = useMemo(() => {
    if (!datasetState.dataset || !userId) return [];
    return retailOrderDataSource.list(
      { deliveryDateFrom: currentDate, deliveryDateTo: currentDate },
      userId,
      sessionVersion,
    );
  }, [currentDate, datasetState.dataset, sessionVersion, userId]);

  return useMemo(
    () => ({
      error: finance.error ?? datasetState.error,
      hasData: Boolean(datasetState.dataset && finance.summary),
      loading: finance.loading || Boolean(userId && !datasetState.dataset && !datasetState.error),
      receivable,
      refreshing: finance.refreshing || Boolean(datasetState.dataset && datasetState.refreshing),
      reload: finance.reload,
      todayDate: currentDate,
      todayOrders,
      todayProfit: finance.summary?.profit ?? null,
      todayRevenue: finance.summary?.revenueReceived ?? null,
    }),
    [
      currentDate,
      datasetState.dataset,
      datasetState.error,
      datasetState.refreshing,
      finance.error,
      finance.loading,
      finance.reload,
      finance.refreshing,
      finance.summary,
      receivable,
      todayOrders,
      userId,
    ],
  );
}
