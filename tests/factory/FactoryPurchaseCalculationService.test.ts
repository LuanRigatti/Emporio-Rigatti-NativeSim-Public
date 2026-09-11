import {
  factoryPurchaseCalculationService,
  MockFactoryPurchaseDataSource,
  mockFactoryPurchaseStorage,
} from '@/services/factory-purchases';
import type { Purchase } from '@/features/factory-purchases/types';

const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    }),
  },
}));

beforeEach(() => {
  mockStorage.clear();
});

function purchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    bucketQuantity: 72,
    bucketUnitPrice: 35,
    date: '2026-08-05',
    id: 'purchase-1',
    payments: [],
    totalAmount: 2520,
    ...overrides,
  };
}

describe('FactoryPurchaseCalculationService', () => {
  it('starts with an empty mock data source', () => {
    expect(new MockFactoryPurchaseDataSource().getPurchases()).toEqual([]);
  });

  it('keeps the historical unit price in the purchase total', () => {
    const item = purchase({ bucketUnitPrice: 35, totalAmount: 2520 });

    expect(item.bucketUnitPrice).toBe(35);
    expect(item.totalAmount).toBe(72 * 35);
  });

  it('summarizes paid, open and bucket totals', () => {
    const result = factoryPurchaseCalculationService.summarize([
      purchase({ payments: [{ amount: 1000, date: '2026-08-05', id: 'payment-1' }] }),
      purchase({ id: 'purchase-2', bucketQuantity: 48, totalAmount: 1680 }),
    ]);

    expect(result.totalPaid).toBe(1000);
    expect(result.openValue).toBe(3200);
    expect(result.totalBuckets).toBe(120);
  });

  it('filters purchases by the selected month and year', () => {
    const result = factoryPurchaseCalculationService.filterByPeriod(
      [
        purchase(),
        purchase({ date: '2026-07-31', id: 'purchase-2' }),
        purchase({ date: '2025-08-05', id: 'purchase-3' }),
      ],
      2026,
      8,
    );

    expect(result.map((item) => item.id)).toEqual(['purchase-1']);
  });

  it('rejects a payment above the remaining balance', () => {
    expect(() =>
      factoryPurchaseCalculationService.assertPaymentWithinBalance(purchase(), 2520.02),
    ).toThrow('saldo restante');
  });

  it('stores payments in the mock data source without changing the unit price', () => {
    const source = new MockFactoryPurchaseDataSource();
    const created = source.createPurchase({
      bucketQuantity: 72,
      bucketUnitPrice: 35,
      date: '2026-08-05',
    });
    const updated = source.addPayment(created.id, { amount: 1000, date: '2026-08-06' });

    expect(updated.bucketUnitPrice).toBe(35);
    expect(updated.totalAmount).toBe(2520);
    expect(updated.payments).toHaveLength(1);
  });

  it('restores purchases persisted by a previous datasource instance', async () => {
    const source = new MockFactoryPurchaseDataSource();
    const created = source.createPurchase({
      bucketQuantity: 72,
      bucketUnitPrice: 35,
      date: '2026-08-05',
    });
    await mockFactoryPurchaseStorage.save(source.getPurchases());

    const restoredSource = new MockFactoryPurchaseDataSource();
    await restoredSource.restore();

    expect(restoredSource.getPurchases()).toEqual([created]);
  });

  it('deletes a purchase together with its linked payments', () => {
    const source = new MockFactoryPurchaseDataSource();
    const created = source.createPurchase({
      bucketQuantity: 72,
      bucketUnitPrice: 35,
      date: '2026-08-05',
    });
    source.addPayment(created.id, { amount: 1000, date: '2026-08-06' });

    source.deletePurchase(created.id);

    expect(source.getPurchases()).toEqual([]);
  });
});
