import { historyGroupingService, historyQueryService } from '@/services/history';
import type { Delivery } from '@/types/data';

function delivery(overrides: Partial<Delivery> = {}): Delivery {
  return {
    id: 'delivery-1',
    cliente: 'Guilherme',
    quantidade: 2,
    valor: 100,
    status: 'Não Pago',
    entregue: true,
    data: '2026-07-25',
    ...overrides,
  };
}

describe('HistoryQueryService', () => {
  it('applies the selected year even when the period is all', () => {
    const result = historyQueryService.filter(
      [delivery({ id: '2026', data: '2026-07-25' }), delivery({ id: '2025', data: '2025-12-30' })],
      { period: 'all', year: '2026', status: 'Todos' },
    );

    expect(result.map((item) => item.id)).toEqual(['2026']);
  });

  it('preserves Ionic status, search and ordering rules', () => {
    const result = historyQueryService.filter(
      [
        delivery({ id: 'late', cliente: 'Aldo', data: '2026-07-24', status: 'Pago' }),
        delivery({ id: 'same-day', cliente: 'Elias', data: '2026-07-25' }),
        delivery({ id: 'other', cliente: 'Outro', data: '2026-07-25' }),
      ],
      { period: 'month', month: '2026-07', search: 'eli', status: 'Não Pago' },
    );

    expect(result.map((item) => item.id)).toEqual(['same-day']);
  });

  it('groups deliveries by month and day with derived day summaries', () => {
    const groups = historyGroupingService.group(
      [
        delivery({ id: 'one', data: '2026-07-25', quantidade: 2 }),
        delivery({ id: 'two', data: '2026-07-25', quantidade: 3 }),
        delivery({ id: 'three', data: '2026-06-25', quantidade: 1 }),
      ],
      { dailyExpenses: {}, monthlyExpenses: {} },
    );

    expect(groups.map((group) => group.key)).toEqual(['2026-07', '2026-06']);
    expect(groups[0]?.days[0]?.date).toBe('2026-07-25');
    expect(groups[0]?.days[0]?.summary).toMatchObject({
      quantity: 5,
      deliveryCount: 2,
      fuelCostPerDelivery: 0,
    });
  });
});
