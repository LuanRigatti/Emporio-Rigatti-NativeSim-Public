import { stockCalculationService } from '@/services/stock/StockCalculationService';
import type { Delivery } from '@/types/data';

function delivery(overrides: Partial<Delivery> = {}): Delivery {
  return {
    cliente: 'Cliente',
    data: '2026-08-10',
    entregue: true,
    id: 'delivery-1',
    quantidade: 3,
    status: 'Pago',
    valor: 100,
    ...overrides,
  };
}

describe('StockCalculationService', () => {
  it('counts all deliveries, including pending ones, in the selected month', () => {
    expect(
      stockCalculationService.calculateSoldBuckets(
        [
          delivery(),
          delivery({ data: '2026-08-11', entregue: false, id: 'pending' }),
          delivery({ data: '2026-07-31', id: 'previous-month' }),
        ],
        2026,
        8,
      ),
    ).toBe(6);
  });

  it('calculates current stock as stock minus sold buckets', () => {
    expect(stockCalculationService.calculateCurrentBuckets(20, 7)).toBe(13);
  });

  it('calculates stock value from current stock and factory bucket cost', () => {
    expect(stockCalculationService.calculateStockValue(13, 35)).toBe(455);
  });
});
