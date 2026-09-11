import { useMemo, useState } from 'react';

import { useDeliveries } from './useDeliveries';
import { historyGroupingService, historyQueryService } from '@/services/history';
import { financialCalculationService } from '@/services/finance';
import type { HistoryFilters } from '@/types/data';

function boundedDeliveryFilters(filters: HistoryFilters) {
  const period = filters.period ?? 'month';
  if (period === 'day') {
    return { mode: 'all' as const, startDate: filters.day, endDate: filters.day, status: filters.status };
  }
  if (period === 'range') {
    return { mode: 'all' as const, startDate: filters.startDate, endDate: filters.endDate, status: filters.status };
  }
  const year = filters.year && filters.year !== 'todos' ? filters.year : String(new Date().getFullYear());
  if (period === 'year' || period === 'all') {
    return { mode: 'all' as const, startDate: `${year}-01-01`, endDate: `${year}-12-31`, status: filters.status };
  }
  const month = filters.month ?? `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [monthYear, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(monthYear, monthNumber, 0).getDate();
  return {
    mode: 'all' as const,
    startDate: `${month}-01`,
    endDate: `${month}-${String(lastDay).padStart(2, '0')}`,
    status: filters.status,
  };
}

export function useHistory(initialFilters: HistoryFilters = {}) {
  const [filters, setFilters] = useState<HistoryFilters>({
    period: 'month',
    status: 'Todos',
    ...initialFilters,
  });
  const deliveries = useDeliveries(boundedDeliveryFilters(filters));
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
