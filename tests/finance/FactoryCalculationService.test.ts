import { FactoryCalculationService } from '@/services/finance/FactoryCalculationService';
import type { FactoryReceipt } from '@/types/data';

const service = new FactoryCalculationService();

function receipt(overrides: Partial<FactoryReceipt> = {}): FactoryReceipt {
  return {
    id: 'receipt-1',
    quantidade: 10,
    data: '2026-07-01',
    valorTotal: 350,
    concluido: false,
    pagamentos: [
      { id: 'payment-1', data: '2026-07-02', valor: 100 },
      { id: 'payment-2', data: '2026-07-03', valor: 250 },
    ],
    ...overrides,
  };
}

describe('FactoryCalculationService', () => {
  it('sums partial payments and preserves the implicit open balance', () => {
    const item = receipt({ pagamentos: [{ id: 'payment-1', data: '2026-07-02', valor: 100 }] });

    expect(service.totalPaid(item)).toBe(100);
    expect(service.openValue(item)).toBe(250);
  });

  it('summarizes receipts without changing persisted values', () => {
    const summary = service.summarize([receipt(), receipt({ id: 'receipt-2', quantidade: 5 })]);

    expect(summary).toEqual({
      totalReceipts: 2,
      totalBuckets: 15,
      totalValue: 700,
      totalPaid: 700,
      openValue: 0,
    });
  });
});
