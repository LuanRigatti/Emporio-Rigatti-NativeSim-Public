import { useMemo } from 'react';

import { financialCalculationService } from '@/services/finance';
import type {
  FinancialCalculationFilters,
  FinancialComparisonResult,
  FinancialSummary,
} from '@/types/data';
import { deliveryQueryService } from '@/services/deliveries';

import { useFinancialData } from './useFinancialData';

export type ReportPeriod = 'day' | 'month' | 'all';

function todayIso(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function financialFiltersForPeriod(
  period: ReportPeriod,
  date = todayIso(),
): FinancialCalculationFilters {
  if (period === 'day') {
    return { periodo: 'dia', diaSelecionado: date };
  }
  if (period === 'all') return { periodo: 'todos' };
  return { periodo: 'mes', mesSelecionado: date.slice(0, 7) };
}

export function useFinancialReport(period: ReportPeriod = 'month') {
  const data = useFinancialData();
  const date = useMemo(() => todayIso(), []);
  const filters = useMemo(() => financialFiltersForPeriod(period, date), [date, period]);
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
    const series = [...groupedByMonth.entries()].map(([key, groupedDeliveries]) => ({
      key,
      label: key,
      value: financialCalculationService.calculateFaturamento(groupedDeliveries),
    }));
    const comparison: FinancialComparisonResult | undefined =
      period === 'month' ? financialCalculationService.comparePeriods(input) : undefined;
    const recentDeliveries = deliveryQueryService.filter(deliveries, { mode: 'all' }).slice(0, 5);
    const pendingDeliveries = deliveries.filter((delivery) => delivery.status !== 'Pago');

    return {
      filters,
      summary,
      deliveries,
      ranking,
      groupedByMonth,
      series,
      comparison,
      recentDeliveries,
      pendingDeliveries,
    };
  }, [data.snapshot, filters, period]);

  return { ...data, date, period, ...computed };
}

export type FinancialReport = ReturnType<typeof useFinancialReport>;

export function summaryValue(summary: FinancialSummary, metric: string): number {
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
    default:
      return 0;
  }
}
