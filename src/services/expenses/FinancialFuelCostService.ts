import type { CarSettings } from '@/services/car';
import { summarizeRouteKilometersByDate } from '@/services/routes/routeTrackingDistance';
import type { DailyExpenses } from '@/types/data';
import type { RouteTrackingSession } from '@/types/routeTracking';
import { normalizeLegacyDate, normalizeMoney } from '@/utils/data';

import { EXPENSE_CUTOFFS, expenseCalculationService } from './ExpenseCalculationService';
import { fuelCostCalculationService, type FuelType } from './FuelCostCalculationService';

export type FinancialFuelValues = {
  fuel: string;
  fuelPrice: string;
  fuelType: string;
  kilometers: string;
};

export type FinancialFuelSettings = {
  getDailyValues: (date: string) => FinancialFuelValues;
  getDailyDates: () => readonly string[];
  getLatestFuelPrice: () => string;
  getLatestFuelType: () => string;
};

export function calculateFinancialFuelCostsByDate(
  dailyExpenses: DailyExpenses,
  routeSessions: readonly RouteTrackingSession[],
  settings: FinancialFuelSettings,
  carSettings: CarSettings,
): Readonly<Record<string, number>> {
  const automaticKilometersByDate = summarizeRouteKilometersByDate(routeSessions);
  const dates = new Set<string>();
  for (const date of [
    ...Object.keys(dailyExpenses),
    ...Object.values(dailyExpenses).map((expense) => expense.data),
    ...Object.keys(automaticKilometersByDate),
    ...settings.getDailyDates(),
  ]) {
    const normalizedDate = normalizeLegacyDate(date);
    if (normalizedDate) dates.add(normalizedDate);
  }

  return Object.fromEntries(
    [...dates].map((date) => {
      const normalizedDate = date;
      const expense = expenseForDate(dailyExpenses, normalizedDate);
      const dailyValues = settings.getDailyValues(normalizedDate);
      const manualKilometers =
        normalizeMoney(expense?.km) ?? normalizeMoney(dailyValues.kilometers) ?? 0;
      const automaticKilometers =
        automaticKilometersByDate[normalizedDate] ?? automaticKilometersByDate[date] ?? 0;
      const fuelPrice =
        normalizeMoney(expense?.precoGasolina) ??
        normalizeMoney(dailyValues.fuelPrice) ??
        normalizeMoney(settings.getLatestFuelPrice()) ??
        0;
      const fuelType = resolveFuelType(
        expense?.tipoCombustivel || dailyValues.fuelType || settings.getLatestFuelType(),
      );

      if (normalizedDate < EXPENSE_CUTOFFS.currentFuelModel) {
        return [
          normalizedDate,
          expenseCalculationService.calculateFuelCost(
            normalizedDate,
            expense ?? {
              data: normalizedDate,
              gasolina: normalizeMoney(dailyValues.fuel) ?? 0,
              km: manualKilometers,
              precoGasolina: fuelPrice,
              tipoCombustivel: fuelType,
            },
            automaticKilometers,
          ),
        ];
      }

      return [
        normalizedDate,
        fuelCostCalculationService.calculate({
          consumption: fuelCostCalculationService.fromCarSettings(carSettings),
          fuelPrice,
          fuelType,
          kilometers: manualKilometers + Math.max(0, automaticKilometers),
        }),
      ];
    }),
  );
}

function expenseForDate(dailyExpenses: DailyExpenses, date: string) {
  return (
    dailyExpenses[date] ??
    Object.entries(dailyExpenses).find(([key, expense]) => {
      return (normalizeLegacyDate(expense.data ?? key) ?? key) === date;
    })?.[1]
  );
}

function resolveFuelType(value: string): FuelType {
  return value === 'etanol' ? 'etanol' : 'gasolina';
}
