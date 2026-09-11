import type { RouteDistanceSummary } from '@/services/routes';
import { routeTrackingRepository } from '@/services/routes';
import { normalizeMoney } from '@/utils/data';

import type { CostValues } from './CostSettingsStorage';
import type { DailyDataRecord } from './DailyDataDataSource';

export class DailyDataQueryService {
  public async getRouteDistanceForDate(date: string): Promise<RouteDistanceSummary> {
    return routeTrackingRepository.getRouteDistanceForDate(date);
  }

  public async getAutomaticKilometers(date: string): Promise<number> {
    return routeTrackingRepository.getTotalDistanceForDate(date);
  }

  public toRecord(date: string, values: CostValues, automaticKilometers = 0): DailyDataRecord {
    const manualKilometers = normalizeMoney(values.kilometers) ?? 0;
    return {
      automaticKilometers,
      date,
      estar: normalizeMoney(values.estar) ?? 0,
      fuel: normalizeMoney(values.fuel) ?? 0,
      fuelPrice: normalizeMoney(values.fuelPrice) ?? 0,
      fuelType: values.fuelType || undefined,
      manualKilometers,
      other: normalizeMoney(values.other) ?? 0,
      totalKilometers: manualKilometers + automaticKilometers,
    };
  }
}

export const dailyDataQueryService = new DailyDataQueryService();
