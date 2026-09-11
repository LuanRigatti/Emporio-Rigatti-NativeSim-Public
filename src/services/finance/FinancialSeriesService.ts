import type {
  DailyExpenses,
  Delivery,
  FinancialChartGranularity,
  FinancialMetric,
  FinancialPeriodSelection,
  FinancialSeriesPoint,
  MonthlyExpenses,
} from '@/types/data';

import { financialCalculationService } from './FinancialCalculationService';
import { financialFiltersForSelection, formatFinancialSeriesLabel } from './FinancialPeriodService';

function addDays(value: string, amount: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function groupRange(key: string, granularity: FinancialChartGranularity): [string, string] {
  if (granularity === 'day') return [key, key];
  if (granularity === 'week') return [key, addDays(key, 6)];
  if (granularity === 'month') {
    const [year, month] = key.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return [`${key}-01`, `${key}-${String(lastDay).padStart(2, '0')}`];
  }
  return [`${key}-01-01`, `${key}-12-31`];
}

function valueForMetric(
  metric: FinancialMetric,
  summary: ReturnType<typeof financialCalculationService.calculateResumo>,
): number {
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

export interface FinancialSeriesInput {
  deliveries: Delivery[];
  dailyExpenses: DailyExpenses;
  monthlyExpenses: MonthlyExpenses;
  today?: Date;
}

export class FinancialSeriesService {
  public buildSeries(
    input: FinancialSeriesInput,
    selection: FinancialPeriodSelection,
    granularity: FinancialChartGranularity,
    metric: FinancialMetric,
  ): FinancialSeriesPoint[] {
    const today = input.today ?? new Date();
    const scopedDeliveries = financialCalculationService.filterDeliveries(
      input.deliveries,
      financialFiltersForSelection(selection),
      today,
    );
    const grouped = financialCalculationService.groupDeliveries(scopedDeliveries, granularity);

    return [...grouped.entries()]
      .map(([key]) => {
        const [start, end] = groupRange(key, granularity);
        const summary = financialCalculationService.calculateResumo({
          deliveries: input.deliveries,
          dailyExpenses: input.dailyExpenses,
          monthlyExpenses: input.monthlyExpenses,
          filters: { periodo: 'range', dataInicioSelecionada: start, dataFimSelecionada: end },
          fullLightInterval: true,
          today,
        });
        return {
          key,
          label: formatFinancialSeriesLabel(key, granularity),
          value: valueForMetric(metric, summary),
        };
      })
      .sort((left, right) => left.key.localeCompare(right.key));
  }
}

export const financialSeriesService = new FinancialSeriesService();
