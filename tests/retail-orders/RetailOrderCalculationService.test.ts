import type { FirestoreTimestamp, RetailPayment } from '@/types/data';
import {
  calculateRetailOrderCostSummary,
  calculateRetailOrderFinancials,
} from '@/services/retail-orders/RetailOrderCalculationService';

const timestamp = { nanoseconds: 0, seconds: 1 } as FirestoreTimestamp;

function payment(
  paymentId: string,
  amount: number,
  status: RetailPayment['status'],
  cardFee?: number,
): RetailPayment {
  return {
    amount,
    ...(cardFee === undefined ? {} : { cardFee }),
    createdAt: timestamp,
    method: 'Pix',
    paidAt: '2026-02-01',
    paymentId,
    status,
  };
}

const order = {
  deliveryCost: 5,
  deliveryFee: 20,
  discount: 1.9,
  lineItems: [
    {
      lineCostTotal: 100,
      lineSubtotal: 201.9,
    },
  ],
  subtotalProducts: 201.9,
  totalCharged: 220,
};

describe('calculateRetailOrderFinancials', () => {
  it('calculates retail revenue, delivery result, received, balance, and net profit', () => {
    const summary = calculateRetailOrderFinancials({
      order,
      otherDirectCosts: 3,
      payments: [payment('posted', 100, 'posted', 2), payment('voided', 50, 'voided', 9)],
    });

    expect(summary).toEqual({
      aReceber: 120,
      recebido: 100,
      custoEntregas: 5,
      custoProdutos: 100,
      deliveryCost: 5,
      deliveryFee: 20,
      discount: 1.9,
      faturamentoProdutos: 200,
      faturamentoTotal: 220,
      financialStatus: 'partially_paid',
      lucroBrutoProdutos: 100,
      lucroLiquido: 110,
      outstandingAmount: 120,
      paidAmount: 100,
      resultadoEntregas: 15,
      subtotalProducts: 201.9,
      taxasCartao: 2,
      totalCharged: 220,
    });
  });

  it('treats a zero-total order as paid and ignores voided payments', () => {
    const summary = calculateRetailOrderFinancials({
      order: {
        ...order,
        deliveryCost: 0,
        deliveryFee: 0,
        discount: order.subtotalProducts,
        lineItems: [{ lineCostTotal: 0, lineSubtotal: 201.9 }],
      },
      payments: [payment('voided', 20, 'voided')],
    });

    expect(summary).toMatchObject({
      aReceber: 0,
      faturamentoProdutos: 0,
      faturamentoTotal: 0,
      financialStatus: 'paid',
      lucroLiquido: 0,
      recebido: 0,
      resultadoEntregas: 0,
    });
  });
});

describe('calculateRetailOrderCostSummary', () => {
  it('uses order snapshots to calculate total cost and gross margin', () => {
    expect(
      calculateRetailOrderCostSummary({
        ...order,
        totalCharged: 220,
      }),
    ).toEqual({
      deliveryCost: 5,
      grossMargin: 115,
      productCost: 100,
      totalCharged: 220,
      totalCost: 105,
    });
  });

  it('does not depend on payments or current catalog costs', () => {
    const first = calculateRetailOrderCostSummary({ ...order, totalCharged: 220 });
    const second = calculateRetailOrderCostSummary({
      ...order,
      lineItems: [{ lineCostTotal: 150, lineSubtotal: 201.9 }],
      totalCharged: 220,
    });

    expect(first.productCost).toBe(100);
    expect(second.productCost).toBe(150);
    expect(second.totalCost).toBe(155);
  });
});
