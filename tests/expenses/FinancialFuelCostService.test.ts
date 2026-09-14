import { calculateFinancialFuelCostsByDate } from '@/services/expenses/FinancialFuelCostService';
import type { DailyExpenses } from '@/types/data';
import type { RouteTrackingSession } from '@/types/routeTracking';

const carSettings = {
  alcoholAutonomy: '5,6 Km/l',
  gasolineAutonomy: '7,4 Km/l',
};

const settings = {
  getDailyDates: () => [],
  getDailyValues: (date: string) => ({
    fuel: '',
    fuelPrice: date === '2026-08-05' ? '6' : '',
    fuelType: 'gasolina',
    kilometers: '',
  }),
  getLatestFuelPrice: () => '6',
  getLatestFuelType: () => 'gasolina',
};

function route(date = '2026-08-05'): RouteTrackingSession {
  return {
    date,
    distanceMeters: 2500,
    durationSeconds: 60,
    endTimestamp: 2,
    id: 'route-1',
    pointsCount: 2,
    samples: [],
    startTimestamp: 1,
    status: 'finalized',
  };
}

describe('FinancialFuelCostService', () => {
  it('sums manual and route kilometers before calculating fuel cost', () => {
    const dailyExpenses: DailyExpenses = {
      '2026-08-05': {
        data: '2026-08-05',
        km: 3,
        precoGasolina: 6,
        tipoCombustivel: 'gasolina',
      },
    };

    const result = calculateFinancialFuelCostsByDate(
      dailyExpenses,
      [route()],
      settings,
      carSettings,
    );

    expect(result['2026-08-05']).toBeCloseTo((5.5 / 7.4) * 6, 8);
  });

  it('calculates route-only fuel cost using the latest configured fuel price', () => {
    const result = calculateFinancialFuelCostsByDate({}, [route()], settings, carSettings);

    expect(result['2026-08-05']).toBeCloseTo((2.5 / 7.4) * 6, 8);
  });

  it('calculates a day present only in gastosDiarios', () => {
    const result = calculateFinancialFuelCostsByDate(
      {
        '2026-09-08': {
          data: '2026-09-08',
          km: 7,
          precoGasolina: 6.59,
          tipoCombustivel: 'gasolina',
        },
      },
      [],
      settings,
      carSettings,
    );

    expect(result['2026-09-08']).toBeCloseTo((7 / 7.4) * 6.59, 8);
  });

  it('includes a Cost Settings-only day in the September fuel aggregation', () => {
    const result = calculateFinancialFuelCostsByDate(
      {},
      [],
      {
        ...settings,
        getDailyDates: () => ['2026-09-06'],
        getDailyValues: (date: string) => ({
          fuel: '',
          fuelPrice: date === '2026-09-06' ? '6' : '',
          fuelType: 'gasolina',
          kilometers: date === '2026-09-06' ? '10' : '',
        }),
      },
      carSettings,
    );

    expect(result['2026-09-06']).toBeCloseTo((10 / 7.4) * 6, 8);
  });

  it('deduplicates a date shared by gastosDiarios, GPS and Cost Settings', () => {
    const result = calculateFinancialFuelCostsByDate(
      {
        '2026-09-06': {
          data: '2026-09-06',
          km: 3,
          precoGasolina: 6,
          tipoCombustivel: 'gasolina',
        },
      },
      [route('2026-09-06')],
      {
        ...settings,
        getDailyDates: () => ['2026-09-06'],
        getDailyValues: (date: string) => ({
          fuel: '',
          fuelPrice: date === '2026-09-06' ? '6' : '',
          fuelType: 'gasolina',
          kilometers: date === '2026-09-06' ? '3' : '',
        }),
      },
      carSettings,
    );

    expect(Object.keys(result)).toEqual(['2026-09-06']);
    expect(result['2026-09-06']).toBeCloseTo((5.5 / 7.4) * 6, 8);
  });
});
