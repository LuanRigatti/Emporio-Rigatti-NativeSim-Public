import type { DailyExpenses, MonthlyExpenses } from './expenses';
import type { Delivery } from './delivery';

export type HistoryPeriod = 'all' | 'year' | 'month' | 'day' | 'week' | 'range';

export interface HistoryFilters {
  period?: HistoryPeriod;
  year?: string | 'todos';
  month?: string;
  day?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  status?: 'Todos' | 'Pago' | 'Não Pago';
}

export interface HistoryDaySummary {
  quantity: number;
  deliveryCount: number;
  fuelCostPerDelivery: number;
}

export interface HistoryDayGroup {
  key: string;
  date: string;
  deliveries: Delivery[];
  summary: HistoryDaySummary;
}

export interface HistoryMonthGroup {
  key: string;
  days: HistoryDayGroup[];
  deliveryCount: number;
  quantity: number;
}

export interface HistoryGroupingInput {
  dailyExpenses: DailyExpenses;
  monthlyExpenses: MonthlyExpenses;
}
