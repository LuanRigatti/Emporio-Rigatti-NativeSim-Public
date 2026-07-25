import type {
  DailyExpenses,
  Delivery,
  ExpenseFilters,
  ExpenseSummary,
  MonthlyExpenses,
} from '@/types/data';

import { expenseCalculationService } from './ExpenseCalculationService';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekRange(date: string): { start: string; end: string } {
  const base = new Date(`${date}T12:00:00`);
  const start = new Date(base);
  start.setDate(base.getDate() - base.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export class ExpenseQueryService {
  public getRange(filters: ExpenseFilters): { start: string; end: string } {
    if (filters.startDate && filters.endDate)
      return { start: filters.startDate, end: filters.endDate };
    if (filters.period === 'day') {
      const date = filters.date ?? todayIso();
      return { start: date, end: date };
    }
    if (filters.period === 'week') return weekRange(filters.date ?? todayIso());
    if (filters.period === 'month') {
      const month = expenseCalculationService.normalizeMonth(filters.month ?? todayIso());
      const [year, monthNumber] = month.split('-').map(Number);
      return {
        start: `${month}-01`,
        end: `${month}-${String(new Date(year, monthNumber, 0).getDate()).padStart(2, '0')}`,
      };
    }
    return { start: '0000-01-01', end: '9999-12-31' };
  }

  public summarize(
    filters: ExpenseFilters,
    dailyExpenses: DailyExpenses,
    monthlyExpenses: MonthlyExpenses,
    deliveries: Delivery[],
  ): ExpenseSummary {
    const range = this.getRange(filters);
    return expenseCalculationService.calculateSummary(
      range.start,
      range.end,
      dailyExpenses,
      monthlyExpenses,
      deliveries,
    );
  }
}

export const expenseQueryService = new ExpenseQueryService();
