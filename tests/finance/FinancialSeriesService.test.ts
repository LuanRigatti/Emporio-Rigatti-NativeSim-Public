import { FinancialSeriesService } from '@/services/finance/FinancialSeriesService';
import type { Delivery } from '@/types/data';
import { getFinancialChartLabelIndexes, getFinancialChartYCoordinates } from '@/utils/data';

const service = new FinancialSeriesService();

function delivery(id: string, data: string, overrides: Partial<Delivery> = {}): Delivery {
  return {
    id,
    cliente: 'Cliente',
    quantidade: 1,
    valor: 100,
    status: 'NÃ£o Pago',
    entregue: true,
    data,
    ...overrides,
  };
}

const input = {
  deliveries: [
    delivery('jan', '2026-01-05', { valor: 100, status: 'Pago' }),
    delivery('jan-2', '2026-01-19', { valor: 50 }),
    delivery('fev', '2026-02-04', { valor: 200, quantidade: 2 }),
  ],
  dailyExpenses: {},
  monthlyExpenses: {},
  today: new Date('2026-02-10T12:00:00'),
};

describe('FinancialSeriesService', () => {
  it('returns no fabricated points for an empty period', () => {
    expect(
      service.buildSeries(input, { kind: 'month', month: '2025-12' }, 'month', 'faturamento'),
    ).toEqual([]);
  });

  it('returns one point for one selected month and multiple points for all months', () => {
    expect(
      service.buildSeries(input, { kind: 'month', month: '2026-01' }, 'month', 'faturamento'),
    ).toEqual([{ key: '2026-01', label: 'Jan/26', value: 150 }]);
    expect(service.buildSeries(input, { kind: 'all' }, 'month', 'faturamento')).toEqual([
      { key: '2026-01', label: 'Jan/26', value: 150 },
      { key: '2026-02', label: 'Fev/26', value: 200 },
    ]);
  });

  it('changes the metric without duplicating the grouping logic', () => {
    expect(service.buildSeries(input, { kind: 'all' }, 'month', 'pago')).toEqual([
      { key: '2026-01', label: 'Jan/26', value: 100 },
      { key: '2026-02', label: 'Fev/26', value: 0 },
    ]);
    expect(service.buildSeries(input, { kind: 'all' }, 'month', 'quantidade')).toEqual([
      { key: '2026-01', label: 'Jan/26', value: 2 },
      { key: '2026-02', label: 'Fev/26', value: 2 },
    ]);
  });

  it('keeps report and chart values consistent for the same month', () => {
    const series = service.buildSeries(
      input,
      { kind: 'month', month: '2026-02' },
      'month',
      'faturamento',
    );
    expect(series[0]?.value).toBe(200);
  });

  it('keeps all points while selecting readable axis labels for long series', () => {
    expect(getFinancialChartLabelIndexes(0, 5)).toEqual([]);
    expect(getFinancialChartLabelIndexes(3, 5)).toEqual([0, 1, 2]);
    expect(getFinancialChartLabelIndexes(20, 5)).toEqual([0, 5, 10, 14, 19]);
  });

  it('maps higher financial values to higher chart positions, including negative profit', () => {
    const coordinates = getFinancialChartYCoordinates([50, 200, 100, 300], 100, 0);
    expect(coordinates[3]).toBeLessThan(coordinates[1]);
    expect(coordinates[1]).toBeLessThan(coordinates[2]);
    expect(coordinates[2]).toBeLessThan(coordinates[0]);

    const mixedCoordinates = getFinancialChartYCoordinates([-100, 50, -20, 200], 100, 0);
    expect(mixedCoordinates[3]).toBeLessThan(mixedCoordinates[1]);
    expect(mixedCoordinates[1]).toBeLessThan(mixedCoordinates[2]);
    expect(mixedCoordinates[2]).toBeLessThan(mixedCoordinates[0]);
    expect(getFinancialChartYCoordinates([100, 100, 100], 100, 0)).toEqual([0, 0, 0]);
  });
});
