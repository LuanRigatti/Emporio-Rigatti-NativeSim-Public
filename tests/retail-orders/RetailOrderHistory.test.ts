import type { FirestoreTimestamp, RetailOrder, RetailPayment } from '@/types/data';
import {
  getRetailOrderHistoryFinancialSignature,
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
  it('changes the financial signature when line cost changes with the same subtotal', () => {
    const original = order('order-signature');
    const changed = order('order-signature', {
      lineItems: [
        {
          ...original.lineItems[0]!,
          lineCostTotal: 45,
        },
      ],
    });

    expect(getRetailOrderHistoryFinancialSignature(changed)).not.toBe(
      getRetailOrderHistoryFinancialSignature(original),
    );
  });

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

  it('reuses the financial summary when only the operational status changes', async () => {
    const paymentReader = {
      list: jest.fn(() => [payment('posted', 30)]),
      load: jest.fn(async () => undefined),
    };
    const service = new RetailOrderHistoryFinancialSummaryService(paymentReader);
    const createdOrder = order('order-status');
    const completedOrder = { ...createdOrder, status: 'completed' as const };

    const first = await service.loadForOrder(createdOrder, 'uid-retail', 1);
    const second = await service.loadForOrder(completedOrder, 'uid-retail', 1);

    expect(paymentReader.load).toHaveBeenCalledTimes(1);
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

  it('invalidates only the deleted order summary cache', async () => {
    const paymentReader = {
      list: jest.fn(() => [payment('posted', 30)]),
      load: jest.fn(async () => undefined),
    };
    const service = new RetailOrderHistoryFinancialSummaryService(paymentReader);
    const deleted = order('order-deleted');
    const retained = order('order-retained');

    await service.loadForOrder(deleted, 'uid-retail', 1);
    await service.loadForOrder(retained, 'uid-retail', 1);
    service.invalidateOrder('order-deleted', 'uid-retail', 1);

    expect(service.getCachedSummary(deleted, 'uid-retail', 1)).toBeUndefined();
    expect(service.getCachedSummary(retained, 'uid-retail', 1)).toBeDefined();
  });

  it('does not republish a deleted order from an in-flight summary load', async () => {
    let resolveLoad!: () => void;
    const paymentReader = {
      list: jest.fn(() => [payment('posted', 30)]),
      load: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveLoad = resolve;
          }),
      ),
    };
    const service = new RetailOrderHistoryFinancialSummaryService(paymentReader);
    const deleted = order('order-deleted-in-flight');
    const result = service.loadForOrder(deleted, 'uid-retail', 1);

    service.invalidateOrder(deleted.orderId, 'uid-retail', 1);
    resolveLoad();

    await expect(result).rejects.toThrow('Resumo financeiro obsoleto.');
    expect(service.getCachedSummary(deleted, 'uid-retail', 1)).toBeUndefined();
  });

  it('updates only the target summary from the complete current payment snapshot', async () => {
    const snapshots: Record<string, RetailPayment[]> = {
      'order-target': [],
      'order-other': [],
    };
    const paymentReader = {
      getSnapshot: jest.fn((orderId: string) => snapshots[orderId] ?? null),
      list: jest.fn((orderId: string) => snapshots[orderId] ?? []),
      load: jest.fn(async () => undefined),
    };
    const service = new RetailOrderHistoryFinancialSummaryService(paymentReader);
    const target = order('order-target');
    const other = order('order-other');

    await service.loadForOrder(target, 'uid-retail', 1);
    await service.loadForOrder(other, 'uid-retail', 1);
    snapshots['order-target'] = [payment('first', 30), payment('second', 20)];
    const listener = jest.fn();
    service.subscribe(listener);

    const summary = service.updateForOrder(target, [payment('second', 20)], 'uid-retail', 1);

    expect(summary).toMatchObject({ financialStatus: 'partially_paid', paidAmount: 50 });
    expect(service.getCachedSummary(target, 'uid-retail', 1)).toMatchObject({ paidAmount: 50 });
    expect(service.getCachedSummary(other, 'uid-retail', 1)).toMatchObject({ paidAmount: 0 });
    expect(paymentReader.load).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('discards a point update when the payment snapshot belongs to another session', () => {
    const paymentReader = {
      getSnapshot: jest.fn(
        (
          _orderId: string,
          userId?: string,
          sessionVersion?: number,
        ): readonly RetailPayment[] | null =>
          userId === 'uid-current' && sessionVersion === 2 ? [payment('current', 20)] : null,
      ),
      list: jest.fn((_orderId: string): RetailPayment[] => []),
      load: jest.fn(async () => undefined),
    };
    const service = new RetailOrderHistoryFinancialSummaryService(paymentReader);
    const target = order('order-stale');

    expect(service.updateForOrder(target, [payment('stale', 20)], 'uid-old', 1)).toBeUndefined();
    expect(service.getCachedSummary(target, 'uid-old', 1)).toBeUndefined();
    expect(
      service.updateForOrder(target, [payment('current', 20)], 'uid-current', 2),
    ).toMatchObject({ paidAmount: 20 });
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
