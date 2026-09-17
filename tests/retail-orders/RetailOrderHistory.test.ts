import type { FirestoreTimestamp, RetailOrder, RetailPayment } from '@/types/data';
import {
  RetailOrderHistoryFinancialSummaryService,
  type RetailOrderHistoryFinancialState,
} from '@/services/retail-orders';
import {
  filterRetailOrdersByOrderDate,
  groupRetailOrdersByOrderDate,
} from '@/features/retail-orders/utils/retailOrderHistoryUtils';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
  },
}));

const timestamp = { nanoseconds: 0, seconds: 1 } as FirestoreTimestamp;

function order(id: string, overrides: Partial<RetailOrder> = {}): RetailOrder {
  return {
    clientId: `client-${id}`,
    clientNameSnapshot: `Cliente ${id}`,
    createdAt: timestamp,
    deliveryAddressSnapshot: 'Rua A, 10',
    deliveryCost: 5,
    deliveryDate: '2026-09-10',
    deliveryFee: 10,
    discount: 0,
    lineItems: [
      {
        categoryIdSnapshot: 'category-1',
        categorySnapshot: 'Cestas',
        costBreakdownSnapshot: [],
        discountAllocatedSnapshot: 0,
        lineCostTotal: 40,
        lineSubtotal: 100,
        productId: `product-${id}`,
        productNameSnapshot: `Produto ${id}`,
        quantity: 1,
        unitCostSnapshot: 40,
        unitSalePriceSnapshot: 100,
      },
    ],
    orderDate: '2026-09-05',
    orderId: id,
    status: 'created',
    subtotalProducts: 100,
    totalCharged: 110,
    updatedAt: timestamp,
    ...overrides,
  };
}

function payment(
  id: string,
  amount: number,
  status: RetailPayment['status'] = 'posted',
): RetailPayment {
  return {
    amount,
    createdAt: timestamp,
    method: 'Pix',
    paidAt: '2026-09-05',
    paymentId: id,
    status,
  };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('Retail order history data', () => {
  it('filters and groups by orderDate, independent of deliveryDate', () => {
    const orders = [
      order('order-b', { deliveryDate: '2026-09-20', orderDate: '2026-09-05' }),
      order('order-a', { deliveryDate: '2026-09-06', orderDate: '2026-09-05' }),
      order('outside', { orderDate: '2026-10-01' }),
    ];

    const visible = filterRetailOrdersByOrderDate(orders, {
      endDate: '2026-09-30',
      startDate: '2026-09-01',
    });
    const groups = groupRetailOrdersByOrderDate(orders, {
      endDate: '2026-09-30',
      startDate: '2026-09-01',
    });

    expect(visible.map((item) => item.orderId)).toEqual(['order-b', 'order-a']);
    expect(groups.map((group) => group.date)).toEqual(['2026-09-05']);
    expect(groups[0]?.orders.map((item) => item.orderId)).toEqual(['order-a', 'order-b']);
  });

  it('loads payment summaries through the central calculation service and caches them', async () => {
    const paymentReader = {
      list: jest.fn(() => [payment('posted', 30), payment('voided', 20, 'voided')]),
      load: jest.fn(async () => undefined),
    };
    const service = new RetailOrderHistoryFinancialSummaryService(paymentReader);
    const target = order('order-1');

    const first = await service.loadForOrder(target, 'uid-retail', 1);
    const second = await service.loadForOrder(target, 'uid-retail', 1);

    expect(paymentReader.load).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({
      financialStatus: 'partially_paid',
      outstandingAmount: 80,
      paidAmount: 30,
      totalCharged: 110,
    });
    expect(second).toEqual(first);
  });

  it('can revalidate a cached summary without clearing the session cache', async () => {
    const paymentReader = {
      list: jest.fn(() => [payment('posted', 30)]),
      load: jest.fn(async () => undefined),
    };
    const service = new RetailOrderHistoryFinancialSummaryService(paymentReader);
    const target = order('order-revalidate');

    await service.loadForOrder(target, 'uid-retail', 1);
    await service.loadForOrder(target, 'uid-retail', 1, { revalidate: true });

    expect(paymentReader.load).toHaveBeenCalledTimes(2);
  });

  it('publishes a hydrated payment summary before remote revalidation completes', async () => {
    let payments: RetailPayment[] = [payment('cached', 30)];
    let resolveRemote!: () => void;
    const remote = new Promise<void>((resolve) => {
      resolveRemote = resolve;
    });
    const onCachedSummary = jest.fn();
    const paymentReader = {
      hydrateFromCache: jest.fn(async () => true),
      list: jest.fn(() => payments),
      load: jest.fn(() => remote),
    };
    const service = new RetailOrderHistoryFinancialSummaryService(paymentReader);
    const resultPromise = service.loadForOrders([order('order-cache-first')], 'uid-retail', 1, {
      onCachedSummary,
    });

    await settle();

    expect(onCachedSummary).toHaveBeenCalledWith(
      'order-cache-first',
      expect.objectContaining({
        outstandingAmount: 80,
        paidAmount: 30,
        totalCharged: 110,
      }),
      true,
    );
    expect(paymentReader.load).toHaveBeenCalledWith('order-cache-first', 'uid-retail', 1);

    payments = [payment('remote', 110)];
    resolveRemote();
    const results = await resultPromise;

    expect(results.get('order-cache-first')).toMatchObject({
      status: 'ready',
      summary: { outstandingAmount: 0, paidAmount: 110, totalCharged: 110 },
    });
  });

  it('treats a hydrated empty cache as known unpaid before remote revalidation', async () => {
    let resolveRemote!: () => void;
    const remote = new Promise<void>((resolve) => {
      resolveRemote = resolve;
    });
    const onCachedSummary = jest.fn();
    const paymentReader = {
      hydrateFromCache: jest.fn(async () => true),
      list: jest.fn(() => []),
      load: jest.fn(() => remote),
    };
    const service = new RetailOrderHistoryFinancialSummaryService(paymentReader);
    const resultPromise = service.loadForOrder(order('order-empty-cache'), 'uid-retail', 1, {
      onCachedSummary,
    });

    await settle();

    expect(onCachedSummary).toHaveBeenCalledWith(
      'order-empty-cache',
      expect.objectContaining({ outstandingAmount: 110, paidAmount: 0, totalCharged: 110 }),
      true,
    );

    resolveRemote();
    await resultPromise;
  });

  it('does not publish an unpaid summary when payment cache is unavailable', async () => {
    let resolveRemote!: () => void;
    const remote = new Promise<void>((resolve) => {
      resolveRemote = resolve;
    });
    const onCachedSummary = jest.fn();
    const paymentReader = {
      hydrateFromCache: jest.fn(async () => false),
      list: jest.fn(() => []),
      load: jest.fn(() => remote),
    };
    const service = new RetailOrderHistoryFinancialSummaryService(paymentReader);
    const resultPromise = service.loadForOrder(order('order-no-cache'), 'uid-retail', 1, {
      onCachedSummary,
    });

    await settle();

    expect(onCachedSummary).not.toHaveBeenCalled();
    resolveRemote();
    await expect(resultPromise).resolves.toMatchObject({ paidAmount: 0, outstandingAmount: 110 });
  });

  it('prewarms known empty and paid caches without reading Firestore', async () => {
    const paymentReader = {
      hydrateFromCache: jest.fn(async (orderId: string) => orderId !== 'order-missing'),
      list: jest.fn((orderId: string) => (orderId === 'order-paid' ? [payment('cached', 30)] : [])),
      load: jest.fn(async () => undefined),
    };
    const service = new RetailOrderHistoryFinancialSummaryService(paymentReader);
    const emptyOrder = order('order-empty-prewarm');
    const paidOrder = order('order-paid');
    const missingOrder = order('order-missing');

    await service.primeFromCache([emptyOrder, paidOrder, paidOrder, missingOrder], 'uid-retail', 1);

    expect(paymentReader.load).not.toHaveBeenCalled();
    await expect(service.loadForOrder(emptyOrder, 'uid-retail', 1)).resolves.toMatchObject({
      outstandingAmount: 110,
      paidAmount: 0,
    });
    await expect(service.loadForOrder(paidOrder, 'uid-retail', 1)).resolves.toMatchObject({
      outstandingAmount: 80,
      paidAmount: 30,
    });
    expect(paymentReader.load).not.toHaveBeenCalled();

    await service.primeFromCache([missingOrder], 'uid-retail', 1);
    expect(paymentReader.hydrateFromCache).toHaveBeenCalledTimes(4);
    await service.loadForOrder(missingOrder, 'uid-retail', 1);
    expect(paymentReader.load).toHaveBeenCalledTimes(1);
  });

  it('keeps a cached summary available when remote revalidation fails', async () => {
    const onCachedSummary = jest.fn();
    const paymentReader = {
      hydrateFromCache: jest.fn(async () => true),
      list: jest.fn(() => [payment('cached', 30)]),
      load: jest.fn(async () => {
        throw new Error('Falha remota');
      }),
    };
    const service = new RetailOrderHistoryFinancialSummaryService(paymentReader);
    const results = await service.loadForOrders([order('order-cache-error')], 'uid-retail', 1, {
      onCachedSummary,
    });

    expect(onCachedSummary).toHaveBeenCalledWith(
      'order-cache-error',
      expect.objectContaining({ paidAmount: 30 }),
      true,
    );
    expect(results.get('order-cache-error')).toEqual({
      message: 'Falha remota',
      status: 'error',
    });
  });

  it('limits visible-order payment reads to controlled workers and keeps errors explicit', async () => {
    const paymentReader = {
      list: jest.fn((orderId: string) => (orderId === 'order-1' ? [payment('posted', 110)] : [])),
      load: jest.fn(async (orderId: string) => {
        if (orderId === 'order-error') throw new Error('Falha de pagamentos');
      }),
    };
    const service = new RetailOrderHistoryFinancialSummaryService(paymentReader);
    const results = await service.loadForOrders(
      [order('order-1'), order('order-2'), order('order-error')],
      'uid-retail',
      1,
    );

    expect(results.get('order-1')).toMatchObject({ status: 'ready' });
    expect(results.get('order-2')).toMatchObject({ status: 'ready' });
    expect(results.get('order-error')).toEqual<RetailOrderHistoryFinancialState>({
      message: 'Falha de pagamentos',
      status: 'error',
    });
    expect(paymentReader.load).toHaveBeenCalledTimes(3);
  });
});
