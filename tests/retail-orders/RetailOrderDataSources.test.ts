import * as firestoreModule from 'firebase/firestore';

import type { FirestoreTimestamp, RetailPayment } from '@/types/data';
import {
  RetailOrderDataSource,
  type RetailOrderCatalogContext,
  RetailPaymentCatalogCache,
  RetailPaymentDataSource,
  RetailOrderCatalogCache,
  retailOrderCatalogCache,
  setFirestoreRetailOrderDataSourceOpsForTesting,
  setFirestoreRetailPaymentDataSourceOpsForTesting,
} from '@/services/retail-orders';
import type { RetailOrderRecord } from '@/services/retail-orders/RetailOrderDataSource';
import type { RetailPaymentRecord } from '@/services/retail-orders/RetailPaymentDataSource';

let mockAsyncStorage: Map<string, string>;

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockAsyncStorage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockAsyncStorage.set(key, value);
    }),
  },
}));

jest.mock('firebase/firestore', () => ({
  __esModule: true,
  collection: jest.fn((...args: unknown[]) => ({ path: args.join('/') })),
  deleteField: jest.fn(() => ({ type: 'deleteField' })),
  doc: jest.fn((...args: unknown[]) => ({
    id: typeof args.at(-1) === 'string' ? args.at(-1) : 'generated-id',
    path: args.join('/'),
  })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  getDocsFromServer: jest.fn(),
  serverTimestamp: jest.fn(() => ({ type: 'serverTimestamp' })),
  setDoc: jest.fn(async () => undefined),
  updateDoc: jest.fn(async () => undefined),
}));

const mockedCollection = jest.mocked(firestoreModule.collection);
const mockedGetDoc = jest.mocked(firestoreModule.getDoc);
const mockedGetDocs = jest.mocked(firestoreModule.getDocs);
const mockedGetDocsFromServer = jest.mocked(firestoreModule.getDocsFromServer);
const mockedSetDoc = jest.mocked(firestoreModule.setDoc);
const mockedUpdateDoc = jest.mocked(firestoreModule.updateDoc);

const timestamp = { nanoseconds: 0, seconds: 1 } as FirestoreTimestamp;

function queryResult(
  records: readonly Record<string, unknown>[] = [],
  fromCache = false,
): Awaited<ReturnType<typeof firestoreModule.getDocs>> {
  return {
    docs: records.map((record, index) => ({
      data: () => record,
      id: String(record.id ?? record.orderId ?? record.paymentId ?? `record-${index + 1}`),
    })),
    metadata: { fromCache },
  } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>;
}

function documentResult(
  data: Record<string, unknown>,
  exists = true,
): Awaited<ReturnType<typeof firestoreModule.getDoc>> {
  return {
    data: () => data,
    exists: () => exists,
  } as unknown as Awaited<ReturnType<typeof firestoreModule.getDoc>>;
}

function costContext(): RetailOrderCatalogContext {
  return {
    categories: [
      {
        active: true,
        categoryId: 'category-1',
        createdAt: timestamp,
        label: 'Cestas',
        normalizedLabel: 'cestas',
        updatedAt: timestamp,
      },
    ],
    costEntriesByItemId: new Map([
      [
        'cost-item-1',
        [
          {
            createdAt: timestamp,
            effectiveDate: '2026-01-01',
            entryId: 'entry-1',
            normalizedUnitCost: 4,
            purchaseTotalCost: 4,
            purchasedQuantity: 1,
            unit: 'unidade',
          },
        ],
      ],
    ]),
    costItems: [
      {
        active: true,
        costItemId: 'cost-item-1',
        createdAt: timestamp,
        name: 'Cesta',
        normalizedName: 'cesta',
        unit: 'unidade',
        updatedAt: timestamp,
      },
    ],
    products: [
      {
        active: true,
        categoryId: 'category-1',
        costMode: 'direct',
        createdAt: timestamp,
        directCostItemId: 'cost-item-1',
        productId: 'product-1',
        productName: 'Cesta Café',
        standardSalePrice: 10,
        updatedAt: timestamp,
      },
    ],
  };
}

function createInput() {
  return {
    clientId: 'retail-client-1',
    clientNameSnapshot: 'Cliente Varejo',
    deliveryAddressSnapshot: 'Rua A, 10',
    deliveryCost: 5,
    deliveryDate: '2026-02-10',
    deliveryFee: 20,
    discount: 0,
    lineItems: [{ productId: 'product-1', quantity: 1 }],
    orderDate: '2026-02-01',
  };
}

function lineItemRecord(overrides: Record<string, unknown> = {}) {
  return {
    categoryIdSnapshot: 'category-1',
    categorySnapshot: 'Cestas',
    costBreakdownSnapshot: [
      {
        costItemId: 'cost-item-1',
        costItemNameSnapshot: 'Cesta',
        effectiveDate: '2026-01-01',
        quantity: 1,
        totalCostSnapshot: 4,
        unit: 'unidade',
        unitCostSnapshot: 4,
      },
    ],
    discountAllocatedSnapshot: 0,
    lineCostTotal: 4,
    lineSubtotal: 10,
    productId: 'product-1',
    productNameSnapshot: 'Cesta Café',
    quantity: 1,
    unitCostSnapshot: 4,
    unitSalePriceSnapshot: 10,
    ...overrides,
  };
}

function orderRecord(id = 'order-1', overrides: Record<string, unknown> = {}) {
  return {
    clientId: 'retail-client-1',
    clientNameSnapshot: 'Cliente Varejo',
    createdAt: timestamp,
    deliveryAddressSnapshot: 'Rua A, 10',
    deliveryCost: 5,
    deliveryDate: '2026-02-10',
    deliveryFee: 20,
    discount: 0,
    lineItems: [lineItemRecord()],
    orderDate: '2026-02-01',
    orderId: id,
    status: 'created',
    subtotalProducts: 10,
    totalCharged: 30,
    updatedAt: timestamp,
    ...overrides,
  };
}

function paymentRecord(
  id = 'payment-1',
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    amount: 40,
    createdAt: timestamp,
    method: 'Pix',
    paidAt: '2026-02-02',
    paymentId: id,
    status: 'posted',
    ...overrides,
  };
}

describe('RetailOrderDataSource and RetailPaymentDataSource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetDoc.mockReset();
    mockedGetDocs.mockReset();
    mockedGetDocsFromServer.mockReset();
    mockedSetDoc.mockReset().mockResolvedValue(undefined);
    mockedUpdateDoc.mockReset().mockResolvedValue(undefined);
    mockAsyncStorage = new Map();
    setFirestoreRetailOrderDataSourceOpsForTesting(firestoreModule, {});
    setFirestoreRetailPaymentDataSourceOpsForTesting(firestoreModule, {});
  });

  afterAll(() => {
    setFirestoreRetailOrderDataSourceOpsForTesting(undefined);
    setFirestoreRetailPaymentDataSourceOpsForTesting(undefined);
  });

  it('creates orders under retailOrders with frozen catalog snapshots', async () => {
    mockedGetDocs.mockResolvedValueOnce(queryResult());
    const dataSource = new RetailOrderDataSource({
      load: jest.fn(async () => undefined),
      list: jest.fn(() => []),
    } as unknown as RetailPaymentDataSource);
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('uid-retail', 1);

    await expect(dataSource.create('uid-retail', createInput(), costContext(), 1)).resolves.toBe(
      'generated-id',
    );

    expect(mockedCollection).toHaveBeenCalledWith({}, 'users', 'uid-retail', 'retailOrders');
    expect(mockedCollection.mock.calls.some((call) => call[3] === 'clients')).toBe(false);
    expect(mockedSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'generated-id' }),
      expect.objectContaining({
        clientId: 'retail-client-1',
        lineItems: [
          expect.objectContaining({
            costBreakdownSnapshot: [expect.objectContaining({ unitCostSnapshot: 4 })],
            productNameSnapshot: 'Cesta Café',
          }),
        ],
        totalCharged: 30,
      }),
    );
  });

  it('marks the complete server snapshot separately from cached history', async () => {
    const dataSource = new RetailOrderDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await retailOrderCatalogCache.write('uid-retail', [
      { ...orderRecord(), id: 'order-1' } as RetailOrderRecord,
    ]);
    mockedGetDocsFromServer.mockResolvedValueOnce(queryResult([]));

    await dataSource.loadHistorical('uid-retail', 1);

    expect(mockedGetDocsFromServer).toHaveBeenCalledTimes(1);
    expect(dataSource.getLoadState('uid-retail', 1)).toMatchObject({
      remoteComplete: true,
      revalidating: false,
      source: 'remote',
    });
    expect(dataSource.getSnapshot('uid-retail', 1)).toEqual([]);
  });

  it('does not treat cached history as remote-complete while server revalidation is pending', async () => {
    const dataSource = new RetailOrderDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await retailOrderCatalogCache.write('uid-retail', [
      { ...orderRecord(), id: 'order-1' } as RetailOrderRecord,
    ]);
    await dataSource.hydrateFromCache('uid-retail', 1);

    let resolveServer: (value: Awaited<ReturnType<typeof firestoreModule.getDocs>>) => void = () =>
      undefined;
    mockedGetDocsFromServer.mockReturnValueOnce(
      new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>((resolve) => {
        resolveServer = resolve;
      }),
    );

    const load = dataSource.loadHistorical('uid-retail', 1);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(dataSource.getLoadState('uid-retail', 1)).toMatchObject({
      remoteComplete: false,
      revalidating: true,
      source: 'cache',
    });
    expect(dataSource.getSnapshot('uid-retail', 1)).toHaveLength(1);

    resolveServer(queryResult([]));
    await load;
  });

  it('updates allowed draft fields and applies lifecycle status locally', async () => {
    mockedGetDocs
      .mockResolvedValueOnce(queryResult([orderRecord()]))
      .mockResolvedValueOnce(
        queryResult([
          orderRecord('order-1', {
            discount: 0.05,
            lineItems: [lineItemRecord({ discountAllocatedSnapshot: 0.05 })],
            totalCharged: 29.95,
          }),
        ]),
      )
      .mockResolvedValueOnce(queryResult([orderRecord('order-1', { status: 'completed' })]));
    const paymentReader = {
      list: jest.fn(() => []),
      load: jest.fn(async () => undefined),
    } as unknown as RetailPaymentDataSource;
    const dataSource = new RetailOrderDataSource(paymentReader);
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('uid-retail', 1);

    await dataSource.update('uid-retail', 'order-1', { discount: 0.05 }, 1);
    expect(mockedUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1' }),
      expect.objectContaining({
        discount: 0.05,
        lineItems: [expect.objectContaining({ discountAllocatedSnapshot: 0.05 })],
        totalCharged: 29.95,
      }),
    );

    await dataSource.complete('uid-retail', 'order-1', 1);
    expect(mockedUpdateDoc).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'order-1' }),
      expect.objectContaining({ status: 'completed' }),
    );
    expect(mockedGetDocs).toHaveBeenCalledTimes(2);
    expect(dataSource.getById('order-1', 'uid-retail', 1)?.status).toBe('completed');
  });

  it('cancels an order without changing its posted payments', async () => {
    mockedGetDocs.mockResolvedValueOnce(queryResult([orderRecord()]));
    const paymentReader = {
      list: jest.fn(() => [payment('posted', 10, 'posted')]),
      load: jest.fn(async () => undefined),
    } as unknown as RetailPaymentDataSource;
    const dataSource = new RetailOrderDataSource(paymentReader);
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('uid-retail', 1);

    await expect(dataSource.cancel('uid-retail', 'order-1', 1)).resolves.toBeUndefined();

    expect(mockedUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1' }),
      expect.objectContaining({ status: 'cancelled' }),
    );
    expect(paymentReader.load).not.toHaveBeenCalled();
    expect(dataSource.getById('order-1', 'uid-retail', 1)?.status).toBe('cancelled');
  });

  it('preserves the existing completed-to-cancelled transition without changing payments', async () => {
    mockedGetDocs.mockResolvedValueOnce(
      queryResult([orderRecord('order-completed', { status: 'completed' })]),
    );
    const paymentReader = {
      list: jest.fn(() => [payment('posted', 10, 'posted')]),
      load: jest.fn(async () => undefined),
    } as unknown as RetailPaymentDataSource;
    const dataSource = new RetailOrderDataSource(paymentReader);
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('uid-retail', 1);

    await dataSource.updateStatus('uid-retail', 'order-completed', 'cancelled', 1);

    expect(mockedUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-completed' }),
      expect.objectContaining({ status: 'cancelled' }),
    );
    expect(paymentReader.load).not.toHaveBeenCalled();
  });

  it('rejects invalid lifecycle status and transitions from cancelled orders', async () => {
    mockedGetDocs.mockResolvedValueOnce(
      queryResult([orderRecord('order-cancelled', { status: 'cancelled' })]),
    );
    const dataSource = new RetailOrderDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('uid-retail', 1);

    await expect(
      dataSource.updateStatus('uid-retail', 'order-cancelled', 'created', 1),
    ).rejects.toMatchObject({ code: 'invalid_order_status' });
    await expect(dataSource.complete('uid-retail', 'order-cancelled', 1)).rejects.toMatchObject({
      code: 'order_not_editable',
    });
    expect(mockedUpdateDoc).not.toHaveBeenCalled();
  });

  it('rejects a lifecycle mutation when the order is missing', async () => {
    mockedGetDocs.mockResolvedValueOnce(queryResult([]));
    mockedGetDoc.mockResolvedValueOnce(documentResult({}, false));
    const dataSource = new RetailOrderDataSource();
    dataSource.setSessionUser('uid-retail', 1);

    await expect(dataSource.complete('uid-retail', 'missing-order', 1)).rejects.toMatchObject({
      code: 'order_not_found',
    });
    expect(mockedUpdateDoc).not.toHaveBeenCalled();
  });

  it('discards a status response after the UID/session changes', async () => {
    mockedGetDocs.mockResolvedValueOnce(queryResult([orderRecord()]));
    let resolveUpdate!: () => void;
    const pendingUpdate = new Promise<void>((resolve) => {
      resolveUpdate = resolve;
    });
    mockedUpdateDoc.mockReturnValueOnce(pendingUpdate);
    const dataSource = new RetailOrderDataSource();
    dataSource.setSessionUser('uid-old', 1);
    await dataSource.load('uid-old', 1);

    const mutation = dataSource.complete('uid-old', 'order-1', 1);
    await new Promise<void>((resolve) => setImmediate(resolve));
    dataSource.setSessionUser('uid-new', 2);
    resolveUpdate();

    await expect(mutation).rejects.toThrow('Sessão alterada durante a operação.');
    expect(dataSource.getSnapshot('uid-new', 2)).toBeNull();
  });

  it('discards an order response after the UID/session changes', async () => {
    let resolveLoad: (value: Awaited<ReturnType<typeof firestoreModule.getDocs>>) => void = () =>
      undefined;
    const pending = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>((resolve) => {
      resolveLoad = resolve;
    });
    mockedGetDocs.mockReturnValueOnce(pending);
    const dataSource = new RetailOrderDataSource();
    dataSource.setSessionUser('uid-old', 1);
    const oldLoad = dataSource.load('uid-old', 1);
    await new Promise<void>((resolve) => setImmediate(resolve));
    dataSource.setSessionUser('uid-new', 2);
    resolveLoad(queryResult([orderRecord('old-order')]));
    await oldLoad;

    expect(dataSource.getSnapshot('uid-old', 1)).toBeNull();
    expect(dataSource.getSnapshot('uid-new', 2)).toBeNull();
  });

  it('keeps order and payment caches isolated by UID', async () => {
    const orderCache = new RetailOrderCatalogCache();
    const paymentCache = new RetailPaymentCatalogCache();
    const orderRecordForCache = { id: 'order-1' } as RetailOrderRecord;
    const paymentRecordForCache = {
      amount: 10,
      id: 'payment-1',
      method: 'Pix',
      paidAt: '2026-02-01',
      status: 'posted',
    } as RetailPaymentRecord;

    await orderCache.write('uid-a', [orderRecordForCache]);
    await paymentCache.write('uid-a', 'order-1', [paymentRecordForCache]);

    await expect(orderCache.read('uid-a')).resolves.toEqual([orderRecordForCache]);
    await expect(orderCache.read('uid-b')).resolves.toBeNull();
    await expect(paymentCache.read('uid-a', 'order-1')).resolves.toEqual([paymentRecordForCache]);
    await expect(paymentCache.read('uid-b', 'order-1')).resolves.toBeNull();
    expect(orderCache.getKey('uid-a')).not.toBe(orderCache.getKey('uid-b'));
    expect(paymentCache.getKey('uid-a', 'order-1')).not.toBe(
      paymentCache.getKey('uid-b', 'order-1'),
    );
  });

  it('registers partial payments only in the nested retail order path', async () => {
    mockedGetDoc.mockResolvedValueOnce(documentResult({ status: 'created', totalCharged: 100 }));
    mockedGetDocs.mockResolvedValueOnce(queryResult());
    const dataSource = new RetailPaymentDataSource();
    dataSource.setSessionUser('uid-retail', 1);

    await expect(
      dataSource.register(
        'uid-retail',
        'order-1',
        { amount: 40, method: 'Pix', paidAt: '2026-02-02' },
        1,
      ),
    ).resolves.toBe('generated-id');

    expect(mockedCollection).toHaveBeenCalledWith(
      {},
      'users',
      'uid-retail',
      'retailOrders',
      'order-1',
      'payments',
    );
    expect(mockedSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'generated-id' }),
      expect.objectContaining({ amount: 40, method: 'Pix', status: 'posted' }),
    );
    expect(dataSource.list('order-1', 'uid-retail', 1)).toEqual([
      expect.objectContaining({ amount: 40, paymentId: 'generated-id' }),
    ]);
  });

  it('allows a payment for a completed order without creating another order', async () => {
    mockedGetDoc.mockResolvedValueOnce(documentResult({ status: 'completed', totalCharged: 100 }));
    mockedGetDocs.mockResolvedValueOnce(queryResult());
    const dataSource = new RetailPaymentDataSource();
    dataSource.setSessionUser('uid-retail', 1);

    await expect(
      dataSource.register(
        'uid-retail',
        'order-completed',
        { amount: 40, method: 'Pix', paidAt: '2026-02-02' },
        1,
      ),
    ).resolves.toBe('generated-id');

    expect(mockedSetDoc).toHaveBeenCalledTimes(1);
    expect(mockedCollection).toHaveBeenCalledWith(
      {},
      'users',
      'uid-retail',
      'retailOrders',
      'order-completed',
      'payments',
    );
  });

  it('distinguishes a hydrated empty payment cache from an unavailable cache', async () => {
    const dataSource = new RetailPaymentDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await new RetailPaymentCatalogCache().write('uid-retail', 'order-empty', []);

    await expect(dataSource.hydrateFromCache('order-empty', 'uid-retail', 1)).resolves.toBe(true);
    expect(dataSource.list('order-empty', 'uid-retail', 1)).toEqual([]);

    await expect(dataSource.hydrateFromCache('order-without-cache', 'uid-retail', 1)).resolves.toBe(
      false,
    );
    expect(dataSource.getSnapshot('order-without-cache', 'uid-retail', 1)).toBeNull();
  });

  it('rejects a payment above the posted balance and cancelled orders', async () => {
    const dataSource = new RetailPaymentDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    mockedGetDoc.mockResolvedValueOnce(documentResult({ status: 'created', totalCharged: 100 }));
    mockedGetDocs.mockResolvedValueOnce(queryResult([paymentRecord('existing', { amount: 80 })]));

    await expect(
      dataSource.register(
        'uid-retail',
        'order-1',
        { amount: 30, method: 'Dinheiro', paidAt: '2026-02-03' },
        1,
      ),
    ).rejects.toMatchObject({ code: 'payment_exceeds_balance' });
    expect(mockedSetDoc).not.toHaveBeenCalled();

    mockedGetDoc.mockResolvedValueOnce(documentResult({ status: 'cancelled', totalCharged: 100 }));
    await expect(
      dataSource.register(
        'uid-retail',
        'order-1',
        { amount: 1, method: 'Pix', paidAt: '2026-02-03' },
        1,
      ),
    ).rejects.toMatchObject({ code: 'order_cancelled' });
  });

  it('discards an in-flight payment response after the session version changes', async () => {
    let resolveLoad: (value: Awaited<ReturnType<typeof firestoreModule.getDocs>>) => void = () =>
      undefined;
    const pending = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>((resolve) => {
      resolveLoad = resolve;
    });
    mockedGetDocs.mockReturnValueOnce(pending);
    const dataSource = new RetailPaymentDataSource();
    dataSource.setSessionUser('uid-same', 1);
    const oldLoad = dataSource.load('order-1', 'uid-same', 1);
    await new Promise<void>((resolve) => setImmediate(resolve));
    dataSource.setSessionUser('uid-same', 2);
    resolveLoad(queryResult([paymentRecord('old-session-payment')]));
    await oldLoad;

    expect(dataSource.getSnapshot('order-1', 'uid-same', 1)).toBeNull();
    expect(dataSource.getSnapshot('order-1', 'uid-same', 2)).toBeNull();
  });
});

function payment(
  paymentId: string,
  amount: number,
  status: RetailPayment['status'],
): RetailPayment {
  return {
    amount,
    createdAt: timestamp,
    method: 'Pix',
    paidAt: '2026-02-01',
    paymentId,
    status,
  };
}
