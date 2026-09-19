import type { RetailOrder, RetailPayment } from '@/types/data';
import { calculateRetailHomeReceivable } from '@/services/retail-finance/RetailHomeMetricsService';

function order(orderId: string, status: RetailOrder['status']): RetailOrder {
  return {
    clientId: `client-${orderId}`,
    clientNameSnapshot: orderId,
    createdAt: {} as RetailOrder['createdAt'],
    deliveryAddressSnapshot: 'Rua Teste, 1',
    deliveryCost: 0,
    deliveryDate: '2026-09-18',
    deliveryFee: 0,
    discount: 0,
    lineItems: [
      {
        categoryIdSnapshot: 'category-1',
        categorySnapshot: 'Cestas',
        costBreakdownSnapshot: [],
        discountAllocatedSnapshot: 0,
        lineCostTotal: 20,
        lineSubtotal: 100,
        productId: 'product-1',
        productNameSnapshot: 'Produto',
        quantity: 1,
        unitCostSnapshot: 20,
        unitSalePriceSnapshot: 100,
      },
    ],
    orderDate: '2026-09-18',
    orderId,
    status,
    subtotalProducts: 100,
    totalCharged: 100,
    updatedAt: {} as RetailOrder['updatedAt'],
  };
}

function payment(
  paymentId: string,
  amount: number,
  status: RetailPayment['status'],
): RetailPayment {
  return {
    amount,
    createdAt: {} as RetailPayment['createdAt'],
    method: 'Pix',
    paidAt: '2026-09-18',
    paymentId,
    status,
  };
}

describe('Retail Home receivable', () => {
  it('delegates each eligible order to canonical financials and excludes cancelled orders', () => {
    const created = order('created', 'created');
    const completed = order('completed', 'completed');
    const cancelled = order('cancelled', 'cancelled');

    const receivable = calculateRetailHomeReceivable({
      orders: [created, completed, cancelled],
      ordersSignature: 'test',
      paymentsByOrderId: new Map([
        [created.orderId, [payment('created-payment', 25, 'posted')]],
        [completed.orderId, [payment('completed-payment', 100, 'posted')]],
        [cancelled.orderId, [payment('cancelled-payment', 50, 'posted')]],
      ]),
    });

    expect(receivable).toBe(75);
  });

  it('does not reduce the balance with voided payments', () => {
    const created = order('created', 'created');

    expect(
      calculateRetailHomeReceivable({
        orders: [created],
        ordersSignature: 'test',
        paymentsByOrderId: new Map([[created.orderId, [payment('voided-payment', 50, 'voided')]]]),
      }),
    ).toBe(100);
  });
});
