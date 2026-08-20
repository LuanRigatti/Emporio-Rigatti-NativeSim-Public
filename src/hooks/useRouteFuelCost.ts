import { useMemo } from 'react';

import { useCarSettings } from '@/hooks/useCarSettings';
import { useCostSettings } from '@/hooks/useCostSettings';
import { fuelCostCalculationService, type FuelType } from '@/services/expenses';
import type { RouteTrackingSession } from '@/types/routeTracking';
import { normalizeMoney } from '@/utils/data';

export function useRouteFuelCost(session?: RouteTrackingSession | null): number {
  const { getLatestDailyValue, getValues } = useCostSettings();
  const { settings: carSettings } = useCarSettings();

  return useMemo(() => {
    if (!session || session.distanceMeters <= 0) return 0;

    const date = session.date;
    const values = getValues('day', date);
    const fuelPrice =
      normalizeMoney(values.fuelPrice) ?? normalizeMoney(getLatestDailyValue('fuelPrice')) ?? 0;
    const persistedFuelType = values.fuelType || getLatestDailyValue('fuelType');
    const fuelType: FuelType = persistedFuelType === 'etanol' ? 'etanol' : 'gasolina';
    const kilometers = session.distanceMeters / 1000;

    return fuelCostCalculationService.calculate({
      consumption: fuelCostCalculationService.fromCarSettings(carSettings),
      fuelPrice,
      fuelType,
      kilometers,
    });
  }, [carSettings, getLatestDailyValue, getValues, session]);
}
