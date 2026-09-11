import { useMemo } from 'react';

import { deliveryQueryService } from '@/services/deliveries';
import { expenseQueryForFinancialSelection } from '@/services/costs';
import {
  financialCalculationService,
  financialFiltersForSelection,
  financialSeriesService,
  selectionFromReportPeriod,
  todayIso,
} from '@/services/finance';
import type {
  FinancialMetric,
  FinancialPeriodSelection,
  FinancialReportPeriod,
  FinancialSummary,
} from '@/types/data';

import { useFinancialData } from './useFinancialData';

export type ReportPeriod = FinancialReportPeriod;
export type ReportPeriodInput = ReportPeriod | FinancialPeriodSelection;

function normalizeSelection(period: ReportPeriodInput, date: string): FinancialPeriodSelection {
  return typeof period === 'string' ? selectionFromReportPeriod(period, date) : period;
}

export function financialFiltersForPeriod(period: ReportPeriodInput, date = todayIso()) {
  return financialFiltersForSelection(normalizeSelection(period, date));
}

export function useFinancialReport(period: ReportPeriodInput = 'month') {
  const date = useMemo(() => todayIso(), []);
  const selection = useMemo(() => normalizeSelection(period, date), [date, period]);
  const filters = useMemo(() => financialFiltersForSelection(selection), [selection]);
  const data = useFinancialData(expenseQueryForFinancialSelection(selection));
  const computed = useMemo(() => {
    if (!data.snapshot) return undefined;
    const input = {
      deliveries: data.snapshot.entregas,
      dailyExpenses: data.snapshot.gastosDiarios,
      monthlyExpenses: data.snapshot.gastosMensais,
      filters,
      today: new Date(),
    };
    const deliveries = financialCalculationService.filterDeliveries(
      data.snapshot.entregas,
      filters,
    );
    const summary = financialCalculationService.calculateResumo(input);
    const ranking = financialCalculationService.rankClients(data.snapshot.entregas, filters);
    const groupedByMonth = financialCalculationService.groupDeliveries(deliveries, 'month');
    const series = financialSeriesService.buildSeries(
      {
        deliveries: data.snapshot.entregas,
        dailyExpenses: data.snapshot.gastosDiarios,
        monthlyExpenses: data.snapshot.gastosMensais,
      },
      selection,
      'month',
      'faturamento',
    );
    const comparison =
      selection.kind === 'month' ? financialCalculationService.comparePeriods(input) : undefined;
    const recentDeliveries = deliveryQueryService.filter(deliveries, { mode: 'all' }).slice(0, 5);
    const pendingDeliveries = deliveries.filter((delivery) => delivery.status !== 'Pago');
    const availableMonths = [
      selection.kind === 'month' ? selection.month : date.slice(0, 7),
      ...data.snapshot.entregas.map((delivery) => delivery.data.slice(0, 7)),
    ]
      .filter((month) => /^\d{4}-\d{2}$/.test(month))
      .filter((month, index, values) => values.indexOf(month) === index)
      .sort((left, right) => right.localeCompare(left));
    const availableYears = availableMonths
      .map((month) => month.slice(0, 4))
      .filter((year, index, values) => values.indexOf(year) === index)
      .sort((left, right) => right.localeCompare(left));

    return {
      filters,
      selection,
      summary,
      deliveries,
      ranking,
      groupedByMonth,
      series,
      comparison,
      recentDeliveries,
      pendingDeliveries,
      availableMonths,
      availableYears,
    };
  }, [data.snapshot, date, filters, selection]);

  return { ...data, date, period: selection.kind, selection, ...computed };
}

export type FinancialReport = ReturnType<typeof useFinancialReport>;

export function summaryValue(summary: FinancialSummary, metric: FinancialMetric): number {
  switch (metric) {
    case 'faturamento':
      return summary.faturamento;
    case 'pago':
      return summary.valoresPagos;
    case 'pendente':
      return summary.valoresPendentes;
    case 'lucroBruto':
      return summary.lucroBruto;
    case 'lucroLiquido':
      return summary.lucroLiquido;
    case 'custos':
      return summary.custoTotal;
    case 'margemBruta':
      return summary.margemBruta;
    case 'margemLiquida':
      return summary.margemLiquida;
    case 'quantidade':
      return summary.quantidadeBaldes;
    case 'precoMedio':
      return summary.precoMedioBalde;
    case 'custoMedio':
      return summary.custoMedioBalde;
  }
}
