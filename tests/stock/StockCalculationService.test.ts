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
    data: '2026-08-10',
    id: 'receipt-1',
    pagamentos: [],
    quantidade: 10,
    valorTotal: 350,
    ...overrides,
  };
}

describe('StockCalculationService', () => {
  it('derives the first period from purchases and deliveries', () => {
    expect(
      stockCalculationService.calculate({
        deliveries: [delivery({ data: '2026-01-20', quantidade: 70 })],
        month: 1,
        receipts: [receipt({ data: '2026-01-10', quantidade: 100 })],
        year: 2026,
      }),
    ).toEqual({
      deliveredBuckets: 70,
      endingBuckets: 30,
      openingBuckets: 0,
      purchasedBuckets: 100,
    });
  });

  it('carries the ending balance into the following months', () => {
    const receipts = [
      receipt({ data: '2026-01-10', id: 'january', quantidade: 100 }),
      receipt({ data: '2026-02-10', id: 'february', quantidade: 50 }),
    ];
    const deliveries = [
      delivery({ data: '2026-01-20', id: 'january-delivery', quantidade: 70 }),
      delivery({ data: '2026-02-20', id: 'february-delivery', quantidade: 60 }),
    ];

    expect(
      stockCalculationService.calculate({ deliveries, month: 2, receipts, year: 2026 }),
    ).toEqual({
      deliveredBuckets: 60,
      endingBuckets: 20,
      openingBuckets: 30,
      purchasedBuckets: 50,
    });
    expect(
      stockCalculationService.calculate({ deliveries, month: 3, receipts, year: 2026 }),
    ).toEqual({
      deliveredBuckets: 0,
      endingBuckets: 20,
      openingBuckets: 20,
      purchasedBuckets: 0,
    });
  });

  it('handles missing movements and multiple movements without mixing periods', () => {
    const summary = stockCalculationService.calculate({
      deliveries: [
        delivery({ data: '2026-04-05', id: 'april-delivery', quantidade: 5 }),
        delivery({ data: '2026-05-05', id: 'may-delivery', quantidade: 7 }),
        delivery({ data: '2026-05-06', id: 'may-delivery-2', quantidade: 3 }),
      ],
      month: 5,
      receipts: [
        receipt({ data: '2026-04-01', id: 'april-receipt', quantidade: 20 }),
        receipt({ data: '2026-05-01', id: 'may-receipt', quantidade: 12 }),
        receipt({ data: '2026-05-02', id: 'may-receipt-2', quantidade: 8 }),
      ],
      year: 2026,
    });

    expect(summary).toEqual({
      deliveredBuckets: 10,
      endingBuckets: 25,
      openingBuckets: 15,
      purchasedBuckets: 20,
    });
  });

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
