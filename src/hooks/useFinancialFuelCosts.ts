import { useMemo } from 'react';

import { useCarSettings } from '@/hooks/useCarSettings';
import { useCostSettings } from '@/hooks/useCostSettings';
import { calculateFinancialFuelCostsByDate, type FinancialFuelSettings } from '@/services/expenses';
import type { DailyExpenses } from '@/types/data';
import type { RouteFinancialSummary } from '@/types/routeTracking';

type UseFinancialFuelCostsOptions = {
  allowCachedInitialSettings?: boolean;
  syncRemoteSettings?: boolean;
};

export function useFinancialFuelCosts(
  dailyExpenses: DailyExpenses,
  routeSessions: readonly RouteFinancialSummary[],
  options: UseFinancialFuelCostsOptions = {},
) {
  const {
    getDailyDates,
    getLatestDailyValue,
    getValues,
    isHydrated: costSettingsReady,
  } = useCostSettings({
    allowCachedInitial: options.allowCachedInitialSettings,
    syncRemote: options.syncRemoteSettings,
  });
  const { isHydrated: carSettingsReady, settings: carSettings } = useCarSettings({
    allowCachedInitial: options.allowCachedInitialSettings,
    syncRemote: options.syncRemoteSettings,
  });

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
