import {
  expenseFiltersForSelection,
  ExpenseQueryService,
} from '@/services/expenses/ExpenseQueryService';
import type { DailyExpenses } from '@/types/data';

const service = new ExpenseQueryService();

const expenses: DailyExpenses = {
  '2026-07-03': { data: '2026-07-03', estar: 3 },
  '2026-07-25': { data: '2026-07-25', gasolina: 25 },
  '2026-07-10': { data: '2026-07-10', km: 10 },
  '2025-12-31': { data: '2025-12-31', estar: 5 },
};

describe('ExpenseQueryService period filters', () => {
  it('converts a selected month to an expense filter', () => {
    expect(expenseFiltersForSelection({ kind: 'month', month: '2026-07' })).toEqual({
      period: 'month',
      month: '2026-07',
    });
  });

  it('converts a selected year to an inclusive date range', () => {
    expect(expenseFiltersForSelection({ kind: 'year', year: '2026' })).toEqual({
      period: 'range',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
  });

  it('converts a custom interval and keeps all periods available', () => {
    expect(
      expenseFiltersForSelection({ kind: 'range', start: '2026-07-01', end: '2026-07-15' }),
    ).toEqual({ period: 'range', startDate: '2026-07-01', endDate: '2026-07-15' });
    expect(expenseFiltersForSelection({ kind: 'all' })).toEqual({ period: 'all' });
  });

  it('filters a month without silently including records from another month', () => {
    const result = service.listDailyExpenses(expenses, {
      period: 'month',
      month: '2026-07',
    });

    expect(result.map((expense) => expense.data)).toEqual([
      '2026-07-25',
      '2026-07-10',
      '2026-07-03',
    ]);
  });

  it('filters a year and orders the most recent records first', () => {
    const result = service.listDailyExpenses(expenses, {
      period: 'range',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });

    expect(result.map((expense) => expense.data)).toEqual([
      '2026-07-25',
      '2026-07-10',
      '2026-07-03',
    ]);
  });

  it('returns an empty list when the selected period has no records', () => {
    expect(
      service.listDailyExpenses(expenses, {
        period: 'month',
        month: '2024-01',
      }),
    ).toEqual([]);
  });
});
