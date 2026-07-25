import { useMemo } from 'react';

import { financialSeriesService } from '@/services/finance';
import type { FinancialChartGranularity, FinancialMetric } from '@/types/data';

import { useFinancialReport, type ReportPeriodInput } from './useFinancialReport';

export function useFinancialSeries(
  period: ReportPeriodInput,
  metric: FinancialMetric,
  granularity: FinancialChartGranularity,
) {
  const report = useFinancialReport(period);
  const series = useMemo(() => {
    if (!report.snapshot) return [];
    return financialSeriesService.buildSeries(
      {
        deliveries: report.snapshot.entregas,
        dailyExpenses: report.snapshot.gastosDiarios,
        monthlyExpenses: report.snapshot.gastosMensais,
      },
      report.selection,
      granularity,
      metric,
    );
  }, [granularity, metric, report.selection, report.snapshot]);

  return { ...report, series };
}
