import { FinancialCalculationService } from '@/services/finance/FinancialCalculationService';
import type { DailyExpenses, Delivery, MonthlyExpenses } from '@/types/data';

const service = new FinancialCalculationService();
const today = new Date('2026-07-24T12:00:00');

function delivery(overrides: Partial<Delivery> = {}): Delivery {
  return {
    id: `delivery-${Math.random()}`,
    cliente: 'Guilherme',
    quantidade: 1,
    valor: 100,
    status: 'Não Pago',
    entregue: true,
    data: '2026-07-01',
    ...overrides,
  };
}

const dailyExpenses: DailyExpenses = {
  '2026-04-30': { data: '2026-04-30', gasolina: 10, estar: 5 },
  '2026-05-01': {
    data: '2026-05-01',
    km: 74,
    precoGasolina: 6,
    tipoCombustivel: 'gasolina',
    estar: 5,
  },
  '2026-07-01': {
    data: '2026-07-01',
    km: 74,
    precoGasolina: 6,
    tipoCombustivel: 'etanol',
    estar: 10,
  },
};

const monthlyExpenses: MonthlyExpenses = { '2026-07': { luz: 100 } };

describe('FinancialCalculationService', () => {
  it('calculates revenue, paid, pending, quantity and bucket cost across the cutoff', () => {
    const result = service.calculateResumo({
      deliveries: [
        delivery({ id: 'before', data: '2026-03-19', quantidade: 2, valor: 100, status: 'Pago' }),
        delivery({ id: 'after', data: '2026-03-20', quantidade: 3, valor: 80, status: 'Não Pago' }),
      ],
      dailyExpenses: {},
      monthlyExpenses: {},
      filters: { periodo: 'todos' },
      today,
    });

    expect(result.faturamento).toBe(180);
    expect(result.valoresPagos).toBe(100);
    expect(result.valoresPendentes).toBe(80);
    expect(result.quantidadeBaldes).toBe(5);
    expect(result.custoTotalBaldes).toBe(169);
    expect(result.lucroBruto).toBe(11);
  });

  it('uses stored values for historical and custom clients without recalculating prices', () => {
    const result = service.calculateResumo({
      deliveries: [
        delivery({ cliente: 'Particular Custom', valor: 123.45, quantidade: 2 }),
        delivery({ cliente: 'Guilherme', valor: 48.5, quantidade: 1 }),
      ],
      dailyExpenses: {},
      monthlyExpenses: {},
      filters: { periodo: 'todos' },
      today,
    });

    expect(result.faturamento).toBeCloseTo(171.95, 8);
    expect(result.precoMedioBalde).toBeCloseTo(57.3166666667, 8);
  });

  it('preserves legacy fuel, gasoline and ethanol calculations', () => {
    expect(
      service.calculateResumo({
        deliveries: [delivery({ data: '2026-04-30' })],
        dailyExpenses,
        monthlyExpenses: {},
        filters: { periodo: 'dia', diaSelecionado: '2026-04-30' },
        today,
      }).custoCombustivel,
    ).toBe(10);

    expect(
      service.calculateResumo({
        deliveries: [delivery({ data: '2026-05-01' })],
        dailyExpenses,
        monthlyExpenses: {},
        filters: { periodo: 'dia', diaSelecionado: '2026-05-01' },
        today,
      }).custoCombustivel,
    ).toBeCloseTo(60, 8);

    expect(
      service.calculateResumo({
        deliveries: [delivery({ data: '2026-07-01' })],
        dailyExpenses,
        monthlyExpenses: {},
        filters: { periodo: 'dia', diaSelecionado: '2026-07-01' },
        today,
      }).custoCombustivel,
    ).toBeCloseTo((74 / 5.6) * 6, 8);
  });

  it('includes local route kilometers in daily fuel and net profit', () => {
    const result = service.calculateResumo({
      deliveries: [delivery({ data: '2026-07-01' })],
      dailyExpenses: dailyExpenses,
      monthlyExpenses: {},
      filters: { periodo: 'dia', diaSelecionado: '2026-07-01' },
      automaticKilometersByDate: { '2026-07-01': 7.4 },
      today,
    });

    expect(result.custoCombustivel).toBeCloseTo((81.4 / 5.6) * 6, 8);
    expect(result.lucroLiquido).toBeCloseTo(
      result.lucroBruto - result.custoEstar - result.custoCombustivel - result.custoLuz,
      8,
    );
  });

  it('uses the resolved combined fuel cost when the route has no daily expense record', () => {
    const result = service.calculateResumo({
      deliveries: [delivery({ data: '2026-07-01' })],
      dailyExpenses: {},
      fuelCostByDate: { '2026-07-01': 12 },
      monthlyExpenses: {},
      filters: { periodo: 'dia', diaSelecionado: '2026-07-01' },
      today,
    });

    expect(result.custoCombustivel).toBe(12);
    expect(result.lucroLiquido).toBe(result.lucroBruto - result.custoEstar - 12 - result.custoLuz);
  });

  it('excludes resolved fuel costs outside the selected month', () => {
    const result = service.calculateResumo({
      deliveries: [],
      dailyExpenses: {},
      fuelCostByDate: {
        '2026-08-31': 10,
        '2026-09-06': 2,
        '2026-10-01': 20,
      },
      monthlyExpenses: {},
      filters: { periodo: 'mes', mesSelecionado: '2026-09' },
      today: new Date('2026-09-30T12:00:00'),
    });

    expect(result.custoCombustivel).toBe(2);
  });

  it('returns zero light allocation when the selected period has no deliveries', () => {
    expect(service.calculateLuzDoPeriodo([], monthlyExpenses, false, today)).toBe(0);
    const result = service.calculateResumo({
      deliveries: [],
      dailyExpenses: { '2026-07-01': { data: '2026-07-01', estar: 20 } },
      monthlyExpenses,
      filters: { periodo: 'dia', diaSelecionado: '2026-07-01' },
      today,
    });
    expect(result.custoEstar).toBe(20);
    expect(result.custoLuz).toBe(0);

    const monthlyResult = service.calculateResumo({
      deliveries: [],
      dailyExpenses: {},
      monthlyExpenses,
      filters: { periodo: 'mes', mesSelecionado: '2026-07' },
      today,
    });
    expect(monthlyResult.custoLuz).toBe(0);

    const twoDeliveryDays = service.calculateResumo({
      deliveries: [
        delivery({ id: 'light-day-1', data: '2026-07-01' }),
        delivery({ id: 'light-day-2', data: '2026-07-03' }),
      ],
      dailyExpenses: {},
      monthlyExpenses,
      filters: { periodo: 'mes', mesSelecionado: '2026-07' },
      today,
    });
    expect(twoDeliveryDays.custoLuz).toBeCloseTo((100 / 14) * 2, 8);
  });

  it('keeps delivery-derived financial values at zero in a month without deliveries', () => {
    const result = service.calculateResumo({
      deliveries: [delivery({ data: '2026-07-20', valor: 100, quantidade: 2 })],
      dailyExpenses: { '2026-08-05': { data: '2026-08-05', estar: 20 } },
      monthlyExpenses: { '2026-08': { luz: 100 } },
      filters: { periodo: 'mes', mesSelecionado: '2026-08' },
      today,
    });

    expect(result.faturamento).toBe(0);
    expect(result.valoresPagos).toBe(0);
    expect(result.valoresPendentes).toBe(0);
    expect(result.quantidadeBaldes).toBe(0);
    expect(result.custoTotalBaldes).toBe(0);
    expect(result.custoLuz).toBe(0);
    expect(result.custoEstar).toBe(20);
    expect(result.lucroBruto).toBe(0);
  });

  it('subtracts monthly Outros costs from net profit', () => {
    const result = service.calculateResumo({
      deliveries: [delivery({ data: '2026-07-01', valor: 100, quantidade: 1 })],
      dailyExpenses: {
        '2026-07-01': { data: '2026-07-01', outros: 12 },
      },
      monthlyExpenses: {},
      filters: { periodo: 'mes', mesSelecionado: '2026-07' },
      today,
    });

    expect(result.custoOutros).toBe(12);
    expect(result.lucroLiquido).toBeCloseTo(
      result.lucroBruto - result.custoEstar - result.custoCombustivel - result.custoLuz - 12,
      8,
    );
  });

  it('calculates light for a working day and keeps it independent from client allocation', () => {
    const deliveries = [
      delivery({ id: 'a', cliente: 'Cliente Customizado', quantidade: 2 }),
      delivery({ id: 'b', cliente: 'Guilherme', quantidade: 3 }),
    ];
    const general = service.calculateLuzDoPeriodo(deliveries, monthlyExpenses, false, today);
    const client = service.calculateRateioLuzPorCliente(
      'Cliente Customizado',
      [deliveries[0]],
      deliveries,
      'dia',
      {},
      monthlyExpenses,
      'Todos',
    );

    expect(general).toBeCloseTo(100 / 14, 8);
    expect(client).toBeCloseTo((100 / 14) * (2 / 5), 8);
    expect((client ?? 0) + (100 / 14) * (3 / 5)).toBeLessThanOrEqual(general + 0.0000001);
  });

  it('distinguishes absent client, valid client without participation and participating client', () => {
    const deliveries = [delivery({ cliente: 'Guilherme', quantidade: 2 })];
    expect(
      service.calculateRateioLuzPorCliente(
        undefined,
        [],
        deliveries,
        'dia',
        {},
        monthlyExpenses,
        'Todos',
      ),
    ).toBeNull();
    expect(
      service.calculateRateioLuzPorCliente(
        'Cliente Customizado',
        [],
        deliveries,
        'dia',
        {},
        monthlyExpenses,
        'Todos',
      ),
    ).toBe(0);
    expect(
      service.calculateRateioLuzPorCliente(
        'Guilherme',
        deliveries,
        deliveries,
        'dia',
        {},
        monthlyExpenses,
        'Todos',
      ),
    ).toBeCloseTo(100 / 14, 8);
  });

  it('returns zero for empty lists, zero quantity and invalid numeric values', () => {
    const invalid = delivery({
      quantidade: 'abc' as unknown as number,
      valor: 'R$ inválido' as unknown as number,
    });
    const result = service.calculateResumo({
      deliveries: [invalid],
      dailyExpenses: {
        '2026-07-01': { data: '2026-07-01', km: 'abc' as unknown as number, precoGasolina: 6 },
      },
      monthlyExpenses: {},
      filters: { periodo: 'todos' },
      today,
    });

    expect(service.calculateFaturamento([])).toBe(0);
    expect(service.calculateQuantidade([delivery({ quantidade: 0 })])).toBe(0);
    expect(result.faturamento).toBe(0);
    expect(result.quantidadeBaldes).toBe(0);
    expect(result.margemBruta).toBe(0);
    expect(result.margemLiquida).toBe(0);
  });

  it('groups and ranks aliases with the Ionic ordering rules', () => {
    const deliveries = [
      delivery({ cliente: 'Santos', valor: 100, quantidade: 1 }),
      delivery({ cliente: 'Elias', valor: 100, quantidade: 2 }),
      delivery({ cliente: 'Aldo', valor: 200, quantidade: 1 }),
    ];
    const ranking = service.rankClients(deliveries, { periodo: 'todos' }, today);
    expect(ranking.map((item) => item.nome)).toEqual(['Elias', 'Aldo']);
    expect(ranking[0].quantidade).toBe(3);
    expect([...service.groupDeliveries(deliveries, 'month').keys()]).toEqual(['2026-07']);
  });

  it('compares equivalent working-day periods with the Ionic fallback percentages', () => {
    const result = service.comparePeriods({
      deliveries: [
        delivery({ data: '2026-07-01', valor: 120 }),
        delivery({ data: '2026-06-01', valor: 100 }),
      ],
      dailyExpenses: {},
      monthlyExpenses: {},
      filters: { periodo: 'mes', mesSelecionado: '2026-07' },
      today: new Date('2026-07-24T12:00:00'),
    });
    expect(result.faturamento.atual).toBe(120);
    expect(result.faturamento.anterior).toBe(100);
    expect(result.faturamento.percentual).toBe(20);
    expect(result.faturamento.subiu).toBe(true);
  });

  it('compares scheduled route days (Mon/Wed/Fri) instead of raw delivery day counts', () => {
    // Current: Aug 2026 up to Friday 2026-08-14 (6 scheduled days: 03, 05, 07, 10, 12, 14)
    // Previous: July 2026 up to Monday 2026-07-13 (6 scheduled days: 01, 03, 06, 08, 10, 13)
    const result = service.compareByDeliveryDays({
      deliveries: [
        // Current month: 3 deliveries on scheduled days, 1 extraordinary on Thursday 13th
        delivery({ id: 'current-1', data: '2026-08-03', valor: 100 }), // Mon (Day 1)
        delivery({ id: 'current-2', data: '2026-08-07', valor: 100 }), // Fri (Day 3)
        delivery({ id: 'current-extra-thu', data: '2026-08-13', valor: 50 }), // Thu (extraordinary)
        delivery({ id: 'current-3', data: '2026-08-14', valor: 100 }), // Fri (Day 6)
        delivery({ id: 'current-after-cutoff', data: '2026-08-17', valor: 500 }), // Mon (Day 7 - after cutoff)

        // Previous month (July 2026):
        delivery({ id: 'previous-1', data: '2026-07-01', valor: 50 }), // Wed (Day 1)
        delivery({ id: 'previous-2', data: '2026-07-06', valor: 50 }), // Mon (Day 3)
        delivery({ id: 'previous-3', data: '2026-07-13', valor: 50 }), // Mon (Day 6)
        delivery({ id: 'previous-after-cutoff', data: '2026-07-20', valor: 1000 }), // Mon (Day 9 - after cutoff)
      ],
      dailyExpenses: {},
      monthlyExpenses: {},
      filters: { periodo: 'mes', mesSelecionado: '2026-08' },
      today: new Date('2026-08-16T12:00:00'), // Sunday 16th -> cutoffs: Aug 14th vs July 13th (N=6)
    });

    expect(result.currentDeliveryDays).toBe(6);
    expect(result.previousDeliveryDays).toBe(6);
    // Current faturamento: 100 + 100 + 50 (extra Thu) + 100 = 350
    expect(result.faturamento.atual).toBe(350);
    // Previous faturamento: 50 + 50 + 50 = 150
    expect(result.faturamento.anterior).toBe(150);
    expect(result.faturamento.subiu).toBe(true);
    expect(result.faturamento.diferenca).toBe(200);
  });

  it('handles scheduled days with zero deliveries as zero performance in N', () => {
    // 6 scheduled days, but current month only has deliveries on day 1 and day 6 (days 2,3,4,5 had 0)
    const result = service.compareByDeliveryDays({
      deliveries: [
        delivery({ id: 'current-1', data: '2026-08-03', valor: 100 }), // Mon (Day 1)
        delivery({ id: 'current-6', data: '2026-08-14', valor: 100 }), // Fri (Day 6)
        delivery({ id: 'previous-1', data: '2026-07-01', valor: 50 }),
        delivery({ id: 'previous-2', data: '2026-07-03', valor: 50 }),
        delivery({ id: 'previous-3', data: '2026-07-06', valor: 50 }),
        delivery({ id: 'previous-4', data: '2026-07-08', valor: 50 }),
        delivery({ id: 'previous-5', data: '2026-07-10', valor: 50 }),
        delivery({ id: 'previous-6', data: '2026-07-13', valor: 50 }),
      ],
      dailyExpenses: {},
      monthlyExpenses: {},
      filters: { periodo: 'mes', mesSelecionado: '2026-08' },
      today: new Date('2026-08-16T12:00:00'),
    });

    expect(result.currentDeliveryDays).toBe(6);
    expect(result.previousDeliveryDays).toBe(6);
    expect(result.faturamento.atual).toBe(200);
    expect(result.faturamento.anterior).toBe(300);
    expect(result.faturamento.subiu).toBe(false);
    expect(result.faturamento.diferenca).toBe(-100);
  });

  it('compares the first real delivery dates when the selected month is complete', () => {
    const result = service.compareCalendarMonths({
      deliveries: [
        delivery({ id: 'current-last-day', data: '2026-08-31', valor: 200 }),
        delivery({ id: 'previous-last-day', data: '2026-07-31', valor: 100 }),
      ],
      dailyExpenses: {},
      monthlyExpenses: {},
      filters: { periodo: 'mes', mesSelecionado: '2026-08' },
      today: new Date('2026-09-01T12:00:00'),
    });

    expect(result.inicioAtual).toBe('2026-08-01');
    expect(result.fimAtual).toBe('2026-08-31');
    expect(result.inicioAnterior).toBe('2026-07-01');
    expect(result.fimAnterior).toBe('2026-07-31');
    expect(result.faturamento.atual).toBe(200);
    expect(result.faturamento.anterior).toBe(100);
    expect(result.faturamento.percentual).toBe(100);
    expect(result.faturamento.subiu).toBe(true);
  });

  it('compares the active month through its real delivery dates', () => {
    const result = service.compareCalendarMonths({
      deliveries: [
        delivery({ id: 'current-through-15', data: '2026-08-15', valor: 200 }),
        delivery({ id: 'current-after-15', data: '2026-08-16', valor: 1000 }),
        delivery({ id: 'previous-through-15', data: '2026-07-15', valor: 100 }),
        delivery({ id: 'previous-after-15', data: '2026-07-16', valor: 1000 }),
      ],
      dailyExpenses: {},
      monthlyExpenses: {},
      filters: { periodo: 'mes', mesSelecionado: '2026-08' },
      today: new Date('2026-08-15T12:00:00'),
    });

    expect(result.fimAtual).toBe('2026-08-15');
    expect(result.fimAnterior).toBe('2026-07-15');
    expect(result.faturamento.atual).toBe(200);
    expect(result.faturamento.anterior).toBe(100);
    expect(result.faturamento.percentual).toBe(100);
  });

  it('includes a real delivery on the last calendar day of the selected month', () => {
    const result = service.compareCalendarMonths({
      deliveries: [
        delivery({ id: 'current-last-day-active', data: '2026-08-31', valor: 200 }),
        delivery({ id: 'previous-last-day-active', data: '2026-07-31', valor: 100 }),
      ],
      dailyExpenses: {},
      monthlyExpenses: {},
      filters: { periodo: 'mes', mesSelecionado: '2026-08' },
      today: new Date('2026-08-31T12:00:00'),
    });

    expect(result.fimAtual).toBe('2026-08-31');
    expect(result.fimAnterior).toBe('2026-07-31');
  });

  it('keeps the revenue trend sign aligned with a calendar-month decrease', () => {
    const result = service.compareCalendarMonths({
      deliveries: [
        delivery({ id: 'current-lower', data: '2026-08-20', valor: 100 }),
        delivery({ id: 'previous-higher', data: '2026-07-20', valor: 200 }),
      ],
      dailyExpenses: {},
      monthlyExpenses: {},
      filters: { periodo: 'mes', mesSelecionado: '2026-08' },
      today: new Date('2026-09-01T12:00:00'),
    });

    expect(result.faturamento.diferenca).toBe(-100);
    expect(result.faturamento.percentual).toBe(-50);
    expect(result.faturamento.subiu).toBe(false);
  });

  it('keeps the net profit trend sign aligned with increases and decreases', () => {
    const lower = service.compareCalendarMonths({
      deliveries: [
        delivery({ id: 'current-net-lower', data: '2026-08-20', valor: 100 }),
        delivery({ id: 'previous-net-higher', data: '2026-07-20', valor: 200 }),
      ],
      dailyExpenses: {},
      monthlyExpenses: {},
      filters: { periodo: 'mes', mesSelecionado: '2026-08' },
      today: new Date('2026-09-01T12:00:00'),
    });
    const higher = service.compareCalendarMonths({
      deliveries: [
        delivery({ id: 'current-net-higher', data: '2026-08-20', valor: 300 }),
        delivery({ id: 'previous-net-lower', data: '2026-07-20', valor: 200 }),
      ],
      dailyExpenses: {},
      monthlyExpenses: {},
      filters: { periodo: 'mes', mesSelecionado: '2026-08' },
      today: new Date('2026-09-01T12:00:00'),
    });

    expect(lower.lucroLiquido.diferenca).toBe(-100);
    expect(lower.lucroLiquido.percentual).toBeCloseTo(-60.6060606, 7);
    expect(lower.lucroLiquido.subiu).toBe(false);
    expect(higher.lucroLiquido.diferenca).toBe(100);
    expect(higher.lucroLiquido.percentual).toBeCloseTo(60.6060606, 7);
    expect(higher.lucroLiquido.subiu).toBe(true);
  });

  it('keeps the zero-denominator fallback for comparable real delivery dates', () => {
    const result = service.compareCalendarMonths({
      deliveries: [
        delivery({ id: 'current-only', data: '2026-08-20', valor: 100 }),
        delivery({ id: 'previous-zero', data: '2026-07-20', valor: 0, quantidade: 0 }),
      ],
      dailyExpenses: {},
      monthlyExpenses: {},
      filters: { periodo: 'mes', mesSelecionado: '2026-08' },
      today: new Date('2026-09-01T12:00:00'),
    });

    expect(result.faturamento.anterior).toBe(0);
    expect(result.faturamento.percentual).toBe(100);
    expect(result.lucroLiquido.anterior).toBe(0);
    expect(result.lucroLiquido.percentual).toBe(100);
  });

  it('compares the first real delivery day instead of the first calendar day', () => {
    const result = service.compareCalendarMonths({
      deliveries: [
        delivery({ id: 'current-first', data: '2026-09-03', valor: 120 }),
        delivery({ id: 'current-later', data: '2026-09-10', valor: 1000 }),
        delivery({ id: 'previous-first', data: '2026-08-05', valor: 60 }),
        delivery({ id: 'previous-later', data: '2026-08-20', valor: 1000 }),
      ],
      dailyExpenses: {},
      monthlyExpenses: {},
      filters: { periodo: 'mes', mesSelecionado: '2026-09' },
      today: new Date('2026-09-03T12:00:00'),
    });

    expect(result.faturamento.atual).toBe(120);
    expect(result.faturamento.anterior).toBe(60);
    expect(result.faturamento.percentual).toBe(100);
    expect(result.fimAtual).toBe('2026-09-03');
    expect(result.fimAnterior).toBe('2026-08-05');
  });

  it('includes multiple deliveries on each ordinal real delivery day', () => {
    const result = service.compareCalendarMonths({
      deliveries: [
        delivery({ id: 'current-first-a', data: '2026-09-03', valor: 100 }),
        delivery({ id: 'current-first-b', data: '2026-09-03', valor: 50 }),
        delivery({ id: 'current-second', data: '2026-09-10', valor: 200 }),
        delivery({ id: 'previous-first', data: '2026-08-05', valor: 80 }),
        delivery({ id: 'previous-second-a', data: '2026-08-12', valor: 20 }),
        delivery({ id: 'previous-second-b', data: '2026-08-12', valor: 10 }),
        delivery({ id: 'previous-after-n', data: '2026-08-20', valor: 1000 }),
      ],
      dailyExpenses: {},
      monthlyExpenses: {},
      filters: { periodo: 'mes', mesSelecionado: '2026-09' },
      today: new Date('2026-09-10T12:00:00'),
    });

    expect(result.faturamento.atual).toBe(350);
    expect(result.faturamento.anterior).toBe(110);
    expect(result.fimAtual).toBe('2026-09-10');
    expect(result.fimAnterior).toBe('2026-08-12');
  });

  it('skips dates without deliveries while accumulating the same ordinal N', () => {
    const result = service.compareCalendarMonths({
      deliveries: [
        delivery({ id: 'current-day-one', data: '2026-09-03', valor: 100 }),
        delivery({ id: 'current-day-two', data: '2026-09-10', valor: 200 }),
        delivery({ id: 'previous-day-one', data: '2026-08-01', valor: 50 }),
        delivery({ id: 'previous-day-two', data: '2026-08-20', valor: 50 }),
      ],
      dailyExpenses: {},
      monthlyExpenses: {},
      filters: { periodo: 'mes', mesSelecionado: '2026-09' },
      today: new Date('2026-09-10T12:00:00'),
    });

    expect(result.faturamento.atual).toBe(300);
    expect(result.faturamento.anterior).toBe(100);
  });

  it('uses the same comparable N for revenue and net profit when month dates differ', () => {
    const currentDeliveries = [
      delivery({ id: 'current-first', data: '2026-09-02', valor: 100 }),
      delivery({ id: 'current-second', data: '2026-09-12', valor: 200 }),
    ];
    const previousDeliveries = [
      delivery({ id: 'previous-first', data: '2026-08-07', valor: 50 }),
      delivery({ id: 'previous-second', data: '2026-08-20', valor: 100 }),
      delivery({ id: 'previous-third', data: '2026-08-31', valor: 1000 }),
    ];
    const result = service.compareCalendarMonths({
      deliveries: [...currentDeliveries, ...previousDeliveries],
      dailyExpenses: {},
      monthlyExpenses: {},
      filters: { periodo: 'mes', mesSelecionado: '2026-09' },
      today: new Date('2026-10-01T12:00:00'),
    });
    const expectedCurrent = service.calculateResumo({
      deliveries: currentDeliveries,
      dailyExpenses: {},
      monthlyExpenses: {},
      filters: { periodo: 'mes', mesSelecionado: '2026-09' },
      today: new Date('2026-10-01T12:00:00'),
    });
    const expectedPrevious = service.calculateResumo({
      deliveries: previousDeliveries.slice(0, 2),
      dailyExpenses: {},
      monthlyExpenses: {},
      filters: { periodo: 'mes', mesSelecionado: '2026-08' },
      today: new Date('2026-10-01T12:00:00'),
    });

    expect(result.faturamento.atual).toBe(expectedCurrent.faturamento);
    expect(result.faturamento.anterior).toBe(expectedPrevious.faturamento);
    expect(result.lucroLiquido.atual).toBe(expectedCurrent.lucroLiquido);
    expect(result.lucroLiquido.anterior).toBe(expectedPrevious.lucroLiquido);
  });

  it('returns neutral comparison when before the first scheduled route of the month', () => {
    const result = service.compareByDeliveryDays({
      deliveries: [delivery({ id: 'current-1', data: '2026-08-01', valor: 100 })],
      dailyExpenses: {},
      monthlyExpenses: {},
      filters: { periodo: 'mes', mesSelecionado: '2026-08' },
      today: new Date('2026-08-02T12:00:00'), // Sunday before Monday 03/08
    });

    expect(result.currentDeliveryDays).toBe(0);
    expect(result.previousDeliveryDays).toBe(0);
    expect(result.faturamento.atual).toBe(0);
    expect(result.faturamento.anterior).toBe(0);
    expect(result.faturamento.diferenca).toBe(0);
  });
});
