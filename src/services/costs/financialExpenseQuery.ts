import type { FinancialPeriodSelection, WholesaleFinanceSelection } from '@/types/data';

import { wholesaleFinanceSelectionToFinancialSelection } from '@/services/finance/FinancialPeriodService';

import type { DailyMonthlyQuery } from './FirestoreDailyMonthlyDataSource';

export function expenseQueryForFinancialSelection(
  selection: FinancialPeriodSelection,
  today = new Date(),
): DailyMonthlyQuery {
  if (selection.kind === 'all') return { loadAll: true };
  if (selection.kind === 'day') return { date: selection.date };
  if (selection.kind === 'week') {
    const start = startOfWeek(selection.date);
    return { startDate: start, endDate: addDays(start, 6) };
  }
  if (selection.kind === 'range') {
    return { startDate: selection.start, endDate: selection.end };
  }
  if (selection.kind === 'year') {
    return { startDate: `${selection.year}-01-01`, endDate: `${selection.year}-12-31` };
  }

  const previous = previousMonth(selection.month);
  const end =
    selection.month === todayIso(today).slice(0, 7) ? todayIso(today) : endOfMonth(selection.month);
  return { startDate: `${previous}-01`, endDate: end };
}

export function expenseQueryForWholesaleFinanceSelection(
  selection: WholesaleFinanceSelection,
  today = new Date(),
): DailyMonthlyQuery {
  return expenseQueryForFinancialSelection(
    wholesaleFinanceSelectionToFinancialSelection(selection),
    today,
  );
}

function todayIso(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
    value.getDate(),
  ).padStart(2, '0')}`;
}

function addDays(value: string, amount: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + amount);
  return todayIso(date);
}

function startOfWeek(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() - date.getDay());
  return todayIso(date);
}

function previousMonth(value: string): string {
  const [year, month] = value.split('-').map(Number);
  return todayIso(new Date(year, month - 2, 1, 12)).slice(0, 7);
}

function endOfMonth(value: string): string {
  const [year, month] = value.split('-').map(Number);
  return todayIso(new Date(year, month, 0, 12));
}
