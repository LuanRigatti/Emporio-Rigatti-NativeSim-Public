import type { RetailOrder, RetailPayment } from '@/types/data';

import { RetailFinanceDatasetService } from '@/services/retail-finance/RetailFinanceDatasetService';

let mockOrders: readonly RetailOrder[] = [];
let mockOrderSnapshotAvailable = true;
let mockPayments = new Map<string, readonly RetailPayment[]>();
let mockResolveHistoryLoad: (() => void) | undefined;
let mockBlockHistoryLoad = false;
const timestamp = { nanoseconds: 0, seconds: 1 } as RetailOrder['createdAt'];

jest.mock('@/services/retail-orders', () => ({
  retailOrderDataSource: {
    getSnapshot: () => (mockOrderSnapshotAvailable ? mockOrders : null),
    hydrateFromCache: jest.fn(async () => undefined),
    list: () => mockOrders.slice(),
    loadHistorical: jest.fn(
      () =>
        new Promise<void>((resolve) => {
          if (mockBlockHistoryLoad) {
            mockResolveHistoryLoad = resolve;
            return;
          }
          resolve();
        }),
    ),
    subscribe: () => () => undefined,
  },
  retailPaymentDataSource: {
    hydrateFromCache: jest.fn(async () => undefined),
    list: (orderId: string) => mockPayments.get(orderId) ?? [],
    load: jest.fn(async () => undefined),
    subscribe: () => () => undefined,
  },
}));

function order(orderId: string): RetailOrder {
  return {
    clientId: `client-${orderId}`,
    clientNameSnapshot: `Cliente ${orderId}`,
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
        productId: `product-${orderId}`,
        productNameSnapshot: `Produto ${orderId}`,
        quantity: 1,
        unitCostSnapshot: 40,
        unitSalePriceSnapshot: 100,
      },
    ],
    orderDate: '2026-09-05',
    orderId,
    status: 'created',
    subtotalProducts: 100,
    totalCharged: 110,
    updatedAt: timestamp,
  };
}

function payment(paymentId: string): RetailPayment {
  return {
    amount: 30,
    createdAt: timestamp,
    method: 'Pix',
    paidAt: '2026-09-05',
    paymentId,
    status: 'posted',
  };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('RetailFinanceDatasetService order deletion invalidation', () => {
  beforeEach(() => {
    mockOrders = [];
    mockOrderSnapshotAvailable = true;
    mockPayments = new Map();
    mockResolveHistoryLoad = undefined;
    mockBlockHistoryLoad = false;
  });

  it('prunes removed order payments and rejects an older reload publication', async () => {
    const deleted = order('order-deleted');
    const retained = order('order-retained');
    mockOrders = [deleted, retained];
    mockPayments = new Map([
      [deleted.orderId, [payment('payment-deleted')]],
      [retained.orderId, [payment('payment-retained')]],
    ]);
    const service = new RetailFinanceDatasetService();

    await service.load('uid-retail', 1);
    expect(
      service.getSnapshot('uid-retail', 1).dataset?.paymentsByOrderId.has('order-deleted'),
    ).toBe(true);

    mockBlockHistoryLoad = true;
    const reload = service.reload('uid-retail', 1);
    await settle();

    mockOrders = [retained];
    (service as unknown as { syncOrderSnapshots: () => void }).syncOrderSnapshots();
    expect(
      service.getSnapshot('uid-retail', 1).dataset?.orders.map((item) => item.orderId),
    ).toEqual(['order-retained']);
    expect(
      service.getSnapshot('uid-retail', 1).dataset?.paymentsByOrderId.has('order-deleted'),
    ).toBe(false);

    mockResolveHistoryLoad?.();
    await reload;
    expect(
      service.getSnapshot('uid-retail', 1).dataset?.orders.map((item) => item.orderId),
    ).toEqual(['order-retained']);
  });
});
