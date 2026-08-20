import { fuelCostCalculationService } from '@/services/expenses/FuelCostCalculationService';
import type { RouteTrackingSession } from '@/types/routeTracking';

describe('Route Fuel Cost calculation', () => {
  const defaultConsumption = {
    ethanolKmL: 5.6,
    gasolineKmL: 7.4,
  };

  it('calculates fuel cost correctly for gasoline route', () => {
    // 26.37 km com gasolina a R$ 5,89 e autonomia 7.4 km/l -> (26.37 / 7.4) * 5.89 = 20.988...
    const session: RouteTrackingSession = {
      date: '2026-08-19',
      distanceMeters: 26370,
      durationSeconds: 1800,
      endTimestamp: 1755600000000,
      id: 'session-1',
      pointsCount: 50,
      samples: [],
      startTimestamp: 1755598200000,
      status: 'finalized',
    };

    const cost = fuelCostCalculationService.calculate({
      consumption: defaultConsumption,
      fuelPrice: 5.89,
      fuelType: 'gasolina',
      kilometers: session.distanceMeters / 1000,
    });

    expect(cost).toBeCloseTo(20.988, 2);
  });

  it('calculates fuel cost correctly for ethanol route', () => {
    // 26.37 km com etanol a R$ 3,99 e autonomia 5.6 km/l -> (26.37 / 5.6) * 3.99 = 18.788...
    const cost = fuelCostCalculationService.calculate({
      consumption: defaultConsumption,
      fuelPrice: 3.99,
      fuelType: 'etanol',
      kilometers: 26.37,
    });

    expect(cost).toBeCloseTo(18.788, 2);
  });

  it('returns 0 when distance or fuel price is 0', () => {
    expect(
      fuelCostCalculationService.calculate({
        consumption: defaultConsumption,
        fuelPrice: 0,
        fuelType: 'gasolina',
        kilometers: 26.37,
      }),
    ).toBe(0);

    expect(
      fuelCostCalculationService.calculate({
        consumption: defaultConsumption,
        fuelPrice: 5.89,
        fuelType: 'gasolina',
        kilometers: 0,
      }),
    ).toBe(0);
  });
});
