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
});
