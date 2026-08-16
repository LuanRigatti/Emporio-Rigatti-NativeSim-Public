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
