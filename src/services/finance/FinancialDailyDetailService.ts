import type {
  DailyExpenses,
  Delivery,
  FinancialMetric,
  FinancialSummary,
  MonthlyExpenses,
} from '@/types/data';
import type { RouteTrackingSession } from '@/types/routeTracking';
import { normalizeLegacyDate, normalizeMoney } from '@/utils/data';
import { summarizeRouteKilometersByDate } from '@/services/routes/routeTrackingDistance';

import { financialCalculationService } from './FinancialCalculationService';

export type MonthlyFinancialDetailMetric = Extract<FinancialMetric, 'faturamento' | 'lucroLiquido'>;

export type FinancialDailyDetail = {
  date: string;
  summary: FinancialSummary;
  manualKilometers: number;
  automaticKilometers: number;
  totalKilometers: number;
  routeCount: number;
};

export type FinancialDailyDetailInput = {
  deliveries: Delivery[];
  dailyExpenses: DailyExpenses;
  fuelCostByDate?: Readonly<Record<string, number>>;
  monthlyExpenses: MonthlyExpenses;
  routeSessions: readonly RouteTrackingSession[];
  today?: Date;
};

function dateOf(value: string): string {
  return normalizeLegacyDate(value) ?? value;
}

function expenseForDate(expenses: DailyExpenses, date: string): DailyExpenses[string] | undefined {
  return expenses[date] ?? Object.entries(expenses).find(([key]) => dateOf(key) === date)?.[1];
}

export function financialMetricValue(
  summary: FinancialSummary,
  metric: MonthlyFinancialDetailMetric,
): number {
  return metric === 'faturamento' ? summary.faturamento : summary.lucroLiquido;
}

export class FinancialDailyDetailService {
  public buildMonth(input: FinancialDailyDetailInput, month: string): FinancialDailyDetail[] {
    const automaticKilometersByDate = summarizeRouteKilometersByDate(input.routeSessions);
    const allDates = new Set<string>();
    const deliveryDates = new Set<string>();

    input.deliveries.forEach((delivery) => {
      const date = dateOf(delivery.data);
      if (date.startsWith(month)) {
        allDates.add(date);
        deliveryDates.add(date);
      }
    });
    Object.keys(input.dailyExpenses).forEach((date) => {
      const normalized = dateOf(date);
      if (normalized.startsWith(month)) allDates.add(normalized);
    });
    input.routeSessions.forEach((session) => {
      if (dateOf(session.date).startsWith(month)) allDates.add(dateOf(session.date));
    });
    const dates = deliveryDates.size > 0 ? deliveryDates : allDates;

    return [...dates]
      .sort((left, right) => left.localeCompare(right))
      .map((date) => {
        const expense = expenseForDate(input.dailyExpenses, date);
        const routeSessions = input.routeSessions.filter(
          (session) => dateOf(session.date) === date,
        );
        const automaticKilometers = automaticKilometersByDate[date] ?? 0;
        const manualKilometers = normalizeMoney(expense?.km) ?? 0;

        const summary = financialCalculationService.calculateResumo({
          deliveries: input.deliveries,
          dailyExpenses: input.dailyExpenses,
          filters: { diaSelecionado: date, periodo: 'dia' },
          monthlyExpenses: input.monthlyExpenses,
          automaticKilometersByDate,
          fuelCostByDate: input.fuelCostByDate,
          today: input.today,
        });

        return {
          automaticKilometers,
          date,
          manualKilometers,
          routeCount: routeSessions.length,
          summary,
          totalKilometers: manualKilometers + automaticKilometers,
        };
      });
  }
}

export const financialDailyDetailService = new FinancialDailyDetailService();
