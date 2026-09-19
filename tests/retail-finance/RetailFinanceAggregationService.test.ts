import type { FirestoreTimestamp, RetailOrder, RetailPayment } from '@/types/data';
import {
  retailFinanceAggregationService,
  retailFinanceViewForCategory,
} from '@/services/retail-finance';

const timestamp = { nanoseconds: 0, seconds: 1 } as FirestoreTimestamp;
const period = { endDate: '2026-09-30', startDate: '2026-09-01' };

function line(
  categorySnapshot: string,
  values: Partial<RetailOrder['lineItems'][number]> = {},
): RetailOrder['lineItems'][number] {
  return {
    categoryIdSnapshot: categorySnapshot.toLowerCase(),
    categorySnapshot,
    costBreakdownSnapshot: [],
    discountAllocatedSnapshot: 0,
    lineCostTotal: 10,
    lineSubtotal: 30,
    productId: `product-${categorySnapshot}`,
    productNameSnapshot: categorySnapshot,
    quantity: 1,
    unitCostSnapshot: 10,
    unitSalePriceSnapshot: 30,
    ...values,
  };
}

function order(
  lineItems: readonly RetailOrder['lineItems'][number][],
  values: Partial<RetailOrder> = {},
): RetailOrder {
  return {
    clientId: 'client-1',
    clientNameSnapshot: 'Cliente',
    createdAt: timestamp,
    deliveryAddressSnapshot: 'Rua A, 1',
    deliveryCost: 5,
    deliveryDate: '2026-09-18',
    deliveryFee: 10,
    discount: 10,
    lineItems,
    orderDate: '2026-09-18',
    orderId: 'order-1',
    status: 'created',
    subtotalProducts: 100,
    totalCharged: 100,
    updatedAt: timestamp,
    ...values,
  };
}

function payment(
  paymentId: string,
  amount: number,
  values: Partial<RetailPayment> = {},
): RetailPayment {
  return {
    amount,
    createdAt: timestamp,
    method: 'Pix',
    paidAt: '2026-09-18',
    paymentId,
    status: 'posted',
    ...values,
  };
}

function paymentsMap(
  payments: readonly RetailPayment[],
): ReadonlyMap<string, readonly RetailPayment[]> {
  return new Map([['order-1', payments]]);
}

describe('RetailFinanceAggregationService', () => {
  it('uses posted payments by paidAt, excludes voided payments, and allocates cents proportionally', () => {
    const currentOrder = order([
      line('Cestas', {
        discountAllocatedSnapshot: 6,
        financeGroupSnapshot: 'baskets',
        lineCostTotal: 20,
        lineSubtotal: 60,
        quantity: 2,
      }),
      line('Baldes', {
        discountAllocatedSnapshot: 4,
        financeGroupSnapshot: 'buckets',
        lineCostTotal: 12,
        lineSubtotal: 40,
      }),
    ]);
    const summary = retailFinanceAggregationService.aggregate(
      [currentOrder],
      paymentsMap([
        payment('payment-a', 40, { cardFee: 1 }),
        payment('payment-b', 60, { cardFee: 2 }),
        payment('payment-voided', 100, { status: 'voided' }),
      ]),
      period,
      'general',
    );

    expect(summary).toMatchObject({
      deliveryCostRecognized: 5,
      deliveryFeeRecognized: 10,
      paymentFees: 3,
      productCostRecognized: 32,
      productRevenueRecognized: 90,
      profit: 60,
      revenueReceived: 100,
      unitsSold: 3,
    });
    expect(summary.series).toEqual([{ key: '2026-09-18', label: '09-18', value: 100 }]);
    expect(summary.orderCount).toBe(1);
  });

  it('keeps category views free of delivery and card-fee allocations', () => {
    const currentOrder = order([
      line('Cestas', {
        discountAllocatedSnapshot: 6,
        financeGroupSnapshot: 'baskets',
        lineCostTotal: 20,
        lineSubtotal: 60,
        quantity: 2,
      }),
      line('Baldes', {
        discountAllocatedSnapshot: 4,
        financeGroupSnapshot: 'buckets',
        lineCostTotal: 12,
        lineSubtotal: 40,
      }),
    ]);
    const summary = retailFinanceAggregationService.aggregate(
      [currentOrder],
      paymentsMap([payment('payment-a', 40, { cardFee: 1 }), payment('payment-b', 60)]),
      period,
      retailFinanceViewForCategory('cestas'),
    );

    expect(summary).toMatchObject({
      deliveryCostRecognized: 0,
      deliveryFeeRecognized: 0,
      paymentFees: 0,
      productCostRecognized: 20,
      productRevenueRecognized: 54,
      revenueReceived: 54,
      unitsSold: 2,
    });
    expect(summary.profit).toBe(34);
  });

  it('uses categoryIdSnapshot instead of financeGroup or label for category views', () => {
    const currentOrder = order(
      [
        line(' CESTAS ', {
          categoryIdSnapshot: 'cestas',
          financeGroupSnapshot: undefined,
          lineSubtotal: 20,
        }),
        line('Linha sem categoria conhecida', {
          financeGroupSnapshot: 'other',
          lineCostTotal: 4,
          lineSubtotal: 10,
        }),
      ],
      { subtotalProducts: 30, totalCharged: 30, discount: 0, deliveryFee: 0, deliveryCost: 0 },
    );
    const payments = paymentsMap([payment('payment-1', 30)]);

    const general = retailFinanceAggregationService.aggregate(
      [currentOrder],
      payments,
      period,
      'general',
    );
    const cestas = retailFinanceAggregationService.aggregate(
      [currentOrder],
      payments,
      period,
      retailFinanceViewForCategory('cestas'),
    );

    expect(general).toMatchObject({ productRevenueRecognized: 30, revenueReceived: 30 });
    expect(cestas).toMatchObject({ productRevenueRecognized: 20, revenueReceived: 20 });
    expect(cestas.unitsSold).toBe(1);

    const other = retailFinanceAggregationService.aggregate(
      [currentOrder],
      payments,
      period,
      retailFinanceViewForCategory('linha sem categoria conhecida'),
    );
    expect(other).toMatchObject({ productRevenueRecognized: 10, revenueReceived: 10 });
  });

  it('returns an empty summary for a valid category with no movement', () => {
    const summary = retailFinanceAggregationService.aggregate(
      [order([line('Cestas')])],
      paymentsMap([payment('payment-1', 30)]),
      period,
      retailFinanceViewForCategory('teste'),
    );

    expect(summary).toMatchObject({
      orderCount: 0,
      productCostRecognized: 0,
      productRevenueRecognized: 0,
      revenueReceived: 0,
      unitsSold: 0,
    });
    expect(summary.series).toEqual([]);
  });

  it('includes cancelled orders when they retain posted revenue and ignores cancelled orders without it', () => {
    const cancelledWithPayment = order([line('Salgados', { financeGroupSnapshot: 'savories' })], {
      deliveryCost: 0,
      deliveryFee: 0,
      status: 'cancelled',
      subtotalProducts: 30,
      totalCharged: 30,
    });
    const cancelledWithoutPayment = order(
      [line('Salgados', { financeGroupSnapshot: 'savories' })],
      {
        deliveryCost: 0,
        deliveryFee: 0,
        orderId: 'order-2',
        status: 'cancelled',
        subtotalProducts: 30,
        totalCharged: 30,
      },
    );
    const summary = retailFinanceAggregationService.aggregate(
      [cancelledWithPayment, cancelledWithoutPayment],
      new Map([
        ['order-1', [payment('payment-1', 30)]],
        ['order-2', []],
      ]),
      period,
      retailFinanceViewForCategory('salgados'),
    );

    expect(summary.orderCount).toBe(1);
    expect(summary.revenueReceived).toBe(30);
  });

  it('does not recognize a posted payment outside the selected paidAt period', () => {
    const currentOrder = order([line('Cestas', { financeGroupSnapshot: 'baskets' })]);
    const summary = retailFinanceAggregationService.aggregate(
      [currentOrder],
      paymentsMap([payment('payment-1', 30, { paidAt: '2026-10-01' })]),
      period,
      'general',
    );

    expect(summary.revenueReceived).toBe(0);
    expect(summary.series).toEqual([]);
  });
});
