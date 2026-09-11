import { FinancialDailyDetailService } from '@/services/finance/FinancialDailyDetailService';
import type { Delivery, DailyExpenses, MonthlyExpenses } from '@/types/data';
import type { RouteTrackingSession } from '@/types/routeTracking';

const service = new FinancialDailyDetailService();

function delivery(id: string, date: string, value: number): Delivery {
  return {
    cliente: 'Cliente',
    data: date,
    entregue: true,
    id,
    quantidade: 1,
    status: 'Pago',
    valor: value,
  };
}

function route(id: string, date: string, distanceMeters: number): RouteTrackingSession {
  return {
    date,
    distanceMeters,
    durationSeconds: 60,
    endTimestamp: 1,
    id,
    pointsCount: 2,
    samples: [],
    startTimestamp: 0,
    status: 'finalized',
  };
}

describe('FinancialDailyDetailService', () => {
  it('builds daily details from deliveries, expenses and local route sessions', () => {
    const dailyExpenses: DailyExpenses = {
      '2026-08-05': { data: '2026-08-05', km: 3, estar: 10 },
    };
    const monthlyExpenses: MonthlyExpenses = {};
    const details = service.buildMonth(
      {
        dailyExpenses,
        deliveries: [delivery('one', '2026-08-05', 100), delivery('two', '2026-08-06', 80)],
        monthlyExpenses,
        routeSessions: [route('route-one', '2026-08-05', 2500)],
        today: new Date('2026-08-10T12:00:00'),
      },
      '2026-08',
    );

    expect(details.map((detail) => detail.date)).toEqual(['2026-08-05', '2026-08-06']);
    expect(details[0]?.manualKilometers).toBe(3);
    expect(details[0]?.automaticKilometers).toBe(2.5);
    expect(details[0]?.totalKilometers).toBe(5.5);
    expect(details[0]?.routeCount).toBe(1);
  });

  it('uses automatic route kilometers when calculating the daily fuel cost', () => {
    const [detail] = service.buildMonth(
      {
        dailyExpenses: {
          '2026-08-05': {
            data: '2026-08-05',
            km: 3,
            precoGasolina: 6,
            tipoCombustivel: 'gasolina',
          },
        },
        deliveries: [delivery('one', '2026-08-05', 100)],
        monthlyExpenses: {},
        routeSessions: [route('route-one', '2026-08-05', 2500)],
      },
      '2026-08',
    );

    expect(detail?.summary.custoCombustivel).toBeCloseTo((5.5 / 7.4) * 6, 8);
  });

  it('does not mix dates or months when building a monthly series', () => {
    const details = service.buildMonth(
      {
        dailyExpenses: {},
        deliveries: [delivery('aug', '2026-08-05', 100), delivery('sep', '2026-09-05', 200)],
        monthlyExpenses: {},
        routeSessions: [route('sep-route', '2026-09-05', 1000)],
      },
      '2026-08',
    );

    expect(details).toHaveLength(1);
    expect(details[0]?.date).toBe('2026-08-05');
  });

  it('shows only delivery dates when the selected month has deliveries', () => {
    const details = service.buildMonth(
      {
        dailyExpenses: {
          '2026-08-04': { data: '2026-08-04', estar: 10 },
          '2026-08-05': { data: '2026-08-05', estar: 10 },
        },
        deliveries: [delivery('delivery', '2026-08-05', 100)],
        monthlyExpenses: {},
        routeSessions: [route('route', '2026-08-04', 1000)],
      },
      '2026-08',
    );

    expect(details.map((detail) => detail.date)).toEqual(['2026-08-05']);
  });

  it('keeps all available dates when the selected month has no deliveries', () => {
    const details = service.buildMonth(
      {
        dailyExpenses: {
          '2026-08-04': { data: '2026-08-04', estar: 10 },
        },
        deliveries: [],
        monthlyExpenses: {},
        routeSessions: [route('route', '2026-08-05', 1000)],
      },
      '2026-08',
    );

    expect(details.map((detail) => detail.date)).toEqual(['2026-08-04', '2026-08-05']);
  });
});
