import type { UnknownRecord } from './common';

export interface DailyExpense {
  data: string;
  estar?: number;
  gasolina?: number;
  km?: number;
  precoGasolina?: number;
  tipoCombustivel?: string;
  legacyFields?: UnknownRecord;
}

export interface MonthlyExpenseRecord {
  luz?: number;
  legacyFields?: UnknownRecord;
}

export type MonthlyExpense = number | MonthlyExpenseRecord;

export type DailyExpenses = Record<string, DailyExpense>;
export type MonthlyExpenses = Record<string, MonthlyExpense>;

export type ExpensePeriod = 'day' | 'week' | 'month' | 'all' | 'range';

export interface ExpenseFilters {
  period: ExpensePeriod;
  date?: string;
  month?: string;
  startDate?: string;
  endDate?: string;
}

export interface ExpenseSummary {
  estar: number;
  combustivel: number;
  luz: number;
  total: number;
  custoMedioCombustivelPorEntrega: number;
}

export interface ClientExpenseAllocation {
  estar: number;
  combustivel: number;
  luz: number;
}

export interface DailyExpenseDraft {
  date: string;
  estar: number;
  km: number;
  fuelPrice: number;
  fuelType?: string;
  legacyFuelCost?: number;
}

export interface MonthlyLightDraft {
  month: string;
  light: number;
}
