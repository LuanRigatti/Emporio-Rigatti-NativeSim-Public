import type {
  FinancialCalculationFilters,
  FinancialPeriodSelection,
  FinancialReportPeriod,
} from '@/types/data';
import {
  formatPtBrCompactMonthYear,
  formatPtBrDate,
  formatPtBrMonthYear,
  todayIso,
} from '@/utils/data';

export { todayIso };

export function selectionFromReportPeriod(
  period: FinancialReportPeriod,
  date = todayIso(),
): FinancialPeriodSelection {
  if (period === 'day') return { kind: 'day', date };
  if (period === 'week') return { kind: 'week', date };
  if (period === 'year') return { kind: 'year', year: date.slice(0, 4) };
  if (period === 'all') return { kind: 'all' };
  if (period === 'range') return { kind: 'range', start: date, end: date };
  return { kind: 'month', month: date.slice(0, 7) };
}

export function financialFiltersForSelection(
  selection: FinancialPeriodSelection,
): FinancialCalculationFilters {
  if (selection.kind === 'day') return { periodo: 'dia', diaSelecionado: selection.date };
  if (selection.kind === 'week') return { periodo: 'semana', dataFiltro: selection.date };
  if (selection.kind === 'month') return { periodo: 'mes', mesSelecionado: selection.month };
  if (selection.kind === 'year') {
    return {
      periodo: 'range',
      dataInicioSelecionada: `${selection.year}-01-01`,
      dataFimSelecionada: `${selection.year}-12-31`,
    };
  }
  if (selection.kind === 'range') {
    return {
      periodo: 'range',
      dataInicioSelecionada: selection.start,
      dataFimSelecionada: selection.end,
    };
  }
  return { periodo: 'todos' };
}

export function formatFinancialPeriodLabel(selection: FinancialPeriodSelection): string {
  if (selection.kind === 'all') return 'Todo o histórico';
  if (selection.kind === 'day') return `Dia ${formatPtBrDate(selection.date)}`;
  if (selection.kind === 'week') return `Semana de ${formatPtBrDate(selection.date)}`;
  if (selection.kind === 'year') return `Ano ${selection.year}`;
  if (selection.kind === 'range') {
    return `${formatPtBrDate(selection.start)} a ${formatPtBrDate(selection.end)}`;
  }
  return formatPtBrMonthYear(selection.month);
}

export function formatFinancialSeriesLabel(
  key: string,
  granularity: 'day' | 'week' | 'month' | 'year',
): string {
  if (granularity === 'day') return formatPtBrDate(key).slice(0, 5);
  if (granularity === 'year') return key;
  if (granularity === 'week') return `Sem. ${formatPtBrDate(key).slice(0, 5)}`;
  return formatPtBrCompactMonthYear(key);
}
