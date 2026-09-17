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
