import { stockCalculationService } from '@/services/stock/StockCalculationService';
import type { Delivery, FactoryReceipt } from '@/types/data';

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

function receipt(overrides: Partial<FactoryReceipt> = {}): FactoryReceipt {
  return {
    concluido: false,
    data: '2026-08-05',
    id: 'receipt-1',
    pagamentos: [],
    quantidade: 10,
    valorTotal: 350,
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

  it('counts factory receipts as purchases by month', () => {
    expect(
      stockCalculationService.calculateFactoryPurchasedBuckets(
        [receipt(), receipt({ data: '2026-07-31', id: 'previous-month' })],
        2026,
        8,
      ),
    ).toBe(10);
  });

  it('calculates the manual initial stock plus purchases minus sold buckets', () => {
    expect(stockCalculationService.calculateCurrentBuckets(20, 10, 7)).toBe(23);
  });
});
