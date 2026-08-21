import {
  MOCK_FACTORY_PURCHASES_STORAGE_KEY,
  MockFactoryReceiptDataSource,
  mockFactoryReceiptStorage,
} from '@/services/factory-purchases';
import { factoryCalculationService } from '@/services/finance/FactoryCalculationService';

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

describe('MockFactoryReceiptDataSource', () => {
  it('creates a receipt, keeps its historical price and total without duplicates', async () => {
    const source = new MockFactoryReceiptDataSource();
    const created = await source.createReceipt({
      bucketUnitPrice: 35,
      date: '2026-08-05',
      quantity: 10,
    });

    expect(created).toMatchObject({
      quantidade: 10,
      precoUnitarioHistorico: 35,
      valorTotal: 350,
      pagamentos: [],
    });
    expect(source.getReceipts()).toHaveLength(1);

    const nextPriceReceipt = await source.createReceipt({
      bucketUnitPrice: 40,
      date: '2026-08-06',
      quantity: 10,
    });

    expect(source.getReceipts()).toHaveLength(2);
    expect(source.getReceipts().find((item) => item.id === created.id)?.valorTotal).toBe(350);
    expect(nextPriceReceipt.valorTotal).toBe(400);
  });

  it('supports partial payments, prevents overpayment and settles exactly at zero', async () => {
    const source = new MockFactoryReceiptDataSource();
    const created = await source.createReceipt({
      bucketUnitPrice: 35,
      date: '2026-08-05',
      quantity: 10,
    });

    const partial = await source.addPayment(created.id, { amount: 100, date: '2026-08-06' });
    expect(factoryCalculationService.totalPaid(partial)).toBe(100);
    expect(factoryCalculationService.openValue(partial)).toBe(250);
    expect(partial.concluido).toBe(false);

    await expect(
      source.addPayment(created.id, { amount: 251, date: '2026-08-07' }),
    ).rejects.toThrow('saldo restante');

    const settled = await source.addPayment(created.id, { amount: 250, date: '2026-08-08' });
    expect(factoryCalculationService.openValue(settled)).toBe(0);
    expect(settled.concluido).toBe(true);
    expect(settled.pagamentos).toHaveLength(2);
    expect(settled.pagamentos.map((payment) => payment.valor)).toEqual([100, 250]);
  });

  it('serializes concurrent payment mutations and rejects the second stale balance attempt', async () => {
    const source = new MockFactoryReceiptDataSource();
    const created = await source.createReceipt({
      bucketUnitPrice: 35,
      date: '2026-08-05',
      quantity: 10,
    });

    const results = await Promise.allSettled([
      source.addPayment(created.id, { amount: 250, date: '2026-08-06' }),
      source.addPayment(created.id, { amount: 250, date: '2026-08-06' }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(source.getReceipts()[0]?.pagamentos).toHaveLength(1);
    expect(factoryCalculationService.openValue(source.getReceipts()[0]!)).toBe(100);
  });

  it('keeps a confirmed payment when a later restore runs', async () => {
    const source = new MockFactoryReceiptDataSource();
    const created = await source.createReceipt({
      bucketUnitPrice: 35,
      date: '2026-08-05',
      quantity: 10,
    });
    await source.addPayment(created.id, { amount: 100, date: '2026-08-06' });

    await source.restore();

    expect(source.getReceipts()[0]?.pagamentos).toEqual([
      expect.objectContaining({ data: '2026-08-06', valor: 100 }),
    ]);
  });

  it('reopens with all persisted payments instead of losing the latest one', async () => {
    const source = new MockFactoryReceiptDataSource();
    const created = await source.createReceipt({
      bucketUnitPrice: 35,
      date: '2026-08-05',
      quantity: 10,
    });
    await source.addPayment(created.id, { amount: 100, date: '2026-08-06' });
    await source.addPayment(created.id, { amount: 50, date: '2026-08-07' });

    const reopenedSource = new MockFactoryReceiptDataSource();
    await reopenedSource.restore();

    expect(reopenedSource.getReceipts()[0]?.pagamentos.map((payment) => payment.valor)).toEqual([
      100,
      50,
    ]);
  });

  it('removes a payment, reopens the receipt and persists through a reload', async () => {
    const source = new MockFactoryReceiptDataSource();
    const created = await source.createReceipt({
      bucketUnitPrice: 35,
      date: '2026-08-05',
      quantity: 10,
    });
    const settled = await source.addPayment(created.id, { amount: 350, date: '2026-08-06' });
    const reopened = await source.removePayment(created.id, settled.pagamentos[0].id);

    expect(reopened.pagamentos).toEqual([]);
    expect(reopened.concluido).toBe(false);
    expect(factoryCalculationService.openValue(reopened)).toBe(350);

    await mockFactoryReceiptStorage.save(source.getReceipts());
    const restoredSource = new MockFactoryReceiptDataSource();
    await restoredSource.restore();
    expect(restoredSource.getReceipts()).toEqual(source.getReceipts());

    await source.deleteReceipt(created.id);
    expect(source.getReceipts()).toEqual([]);
  });

  it('reads purchases stored by the previous mock datasource without duplicating them', async () => {
    mockStorage.set(
      MOCK_FACTORY_PURCHASES_STORAGE_KEY,
      JSON.stringify([
        {
          bucketQuantity: 10,
          bucketUnitPrice: 35,
          date: '2026-08-05',
          id: 'legacy-purchase',
          payments: [{ amount: 100, date: '2026-08-06', id: 'legacy-payment' }],
          totalAmount: 350,
        },
      ]),
    );

    const source = new MockFactoryReceiptDataSource();
    await source.restore();

    expect(source.getReceipts()).toHaveLength(1);
    expect(source.getReceipts()[0]).toMatchObject({
      id: 'legacy-purchase',
      quantidade: 10,
      valorTotal: 350,
      pagamentos: [{ id: 'legacy-payment', valor: 100 }],
    });
  });

  it('deletes a receipt together with its linked payments', async () => {
    const source = new MockFactoryReceiptDataSource();
    const created = await source.createReceipt({
      bucketUnitPrice: 35,
      date: '2026-08-05',
      quantity: 10,
    });
    await source.addPayment(created.id, { amount: 100, date: '2026-08-06' });

    await source.deleteReceipt(created.id);

    expect(source.getReceipts()).toEqual([]);
  });

  it('notifies subscribers on creation, payment and deletion', async () => {
    const source = new MockFactoryReceiptDataSource();
    await source.restore();
    const listener = jest.fn();
    const unsubscribe = source.subscribe(listener);

    const created = await source.createReceipt({
      bucketUnitPrice: 35,
      date: '2026-08-05',
      quantity: 10,
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(created.createdAt).toBeDefined();

    await source.addPayment(created.id, { amount: 100, date: '2026-08-06' });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(source.getReceipts()[0]?.pagamentos).toHaveLength(1);

    await source.deleteReceipt(created.id);
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    await source.createReceipt({
      bucketUnitPrice: 35,
      date: '2026-08-05',
      quantity: 5,
    });
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
