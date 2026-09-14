import { useMemo } from 'react';

import { useCarSettings } from '@/hooks/useCarSettings';
import { useCostSettings } from '@/hooks/useCostSettings';
import { calculateFinancialFuelCostsByDate, type FinancialFuelSettings } from '@/services/expenses';
import type { DailyExpenses } from '@/types/data';
import type { RouteTrackingSession } from '@/types/routeTracking';

export function useFinancialFuelCosts(
  dailyExpenses: DailyExpenses,
  routeSessions: readonly RouteTrackingSession[],
) {
  const {
    getDailyDates,
    getLatestDailyValue,
    getValues,
    isHydrated: costSettingsReady,
  } = useCostSettings();
  const { isHydrated: carSettingsReady, settings: carSettings } = useCarSettings();

  const settings = useMemo<FinancialFuelSettings>(
    () => ({
      getDailyValues: (date) => getValues('day', date),
      getDailyDates,
      getLatestFuelPrice: () => getLatestDailyValue('fuelPrice'),
      getLatestFuelType: () => getLatestDailyValue('fuelType'),
    }),
    [getDailyDates, getLatestDailyValue, getValues],
  );
  const fuelCostByDate = useMemo(
    () => calculateFinancialFuelCostsByDate(dailyExpenses, routeSessions, settings, carSettings),
    [carSettings, dailyExpenses, routeSessions, settings],
  );

  return {
    fuelCostByDate,
    isReady: costSettingsReady && carSettingsReady,
  };
}
