import { useMemo, useState } from 'react';

import { useDeliveries } from './useDeliveries';
import { historyGroupingService, historyQueryService } from '@/services/history';
import { financialCalculationService } from '@/services/finance';
import type { HistoryFilters } from '@/types/data';

export function useHistory(initialFilters: HistoryFilters = {}) {
  const [filters, setFilters] = useState<HistoryFilters>({
    period: 'month',
    status: 'Todos',
    ...initialFilters,
  });
  const deliveries = useDeliveries({ mode: 'all' });
  const filteredDeliveries = useMemo(
    () => historyQueryService.filter(deliveries.allDeliveries, filters),
    [deliveries.allDeliveries, filters],
  );
  const monthGroups = useMemo(
    () =>
      historyGroupingService.group(filteredDeliveries, {
        dailyExpenses: deliveries.snapshot?.gastosDiarios ?? {},
        monthlyExpenses: deliveries.snapshot?.gastosMensais ?? {},
      }),
    [deliveries.snapshot?.gastosDiarios, deliveries.snapshot?.gastosMensais, filteredDeliveries],
  );
  const availableYears = useMemo(
    () => historyQueryService.availableYears(deliveries.allDeliveries),
    [deliveries.allDeliveries],
  );
  const ranking = useMemo(
    () => financialCalculationService.rankClients(filteredDeliveries, { periodo: 'todos' }),
    [filteredDeliveries],
  );

  return {
    ...deliveries,
    filters,
    setFilters,
    filteredDeliveries,
    monthGroups,
    availableYears,
    ranking,
  };
}

export type UseHistoryResult = ReturnType<typeof useHistory>;
