import type {
  RetailFinancialStatus,
  RetailOrder,
  RetailOrderFinancialSummary,
  RetailOrderLineItem,
  RetailPayment,
} from '@/types/data';

import { roundRetailOrderMoney } from './retailOrderUtils';

export type RetailOrderCalculationInput = {
  order: Pick<RetailOrder, 'discount' | 'deliveryFee' | 'deliveryCost'> & {
    lineItems: readonly Pick<RetailOrderLineItem, 'lineCostTotal' | 'lineSubtotal'>[];
  };
  payments?: readonly RetailPayment[];
  otherDirectCosts?: number;
};

function financialStatusFor(totalCharged: number, paidAmount: number): RetailFinancialStatus {
  if (totalCharged === 0 || paidAmount >= totalCharged) return 'paid';
  if (paidAmount === 0) return 'unpaid';
  return 'partially_paid';
}

export function calculateRetailOrderFinancials(
  input: RetailOrderCalculationInput,
): RetailOrderFinancialSummary {
  if (
    input.order.lineItems.some(
      (lineItem) =>
        !Number.isFinite(lineItem.lineSubtotal) ||
        lineItem.lineSubtotal < 0 ||
        !Number.isFinite(lineItem.lineCostTotal) ||
        lineItem.lineCostTotal < 0,
    )
  ) {
    throw new Error('Os itens do pedido possuem valores inválidos.');
  }
  const subtotalProducts = roundRetailOrderMoney(
    input.order.lineItems.reduce((total, lineItem) => total + lineItem.lineSubtotal, 0),
  );
  const discount = roundRetailOrderMoney(input.order.discount);
  if (subtotalProducts < 0 || discount < 0 || discount > subtotalProducts) {
    throw new Error('Subtotal e desconto do pedido são inválidos.');
  }
  const faturamentoProdutos = roundRetailOrderMoney(subtotalProducts - discount);
  const deliveryFee = roundRetailOrderMoney(input.order.deliveryFee);
  const deliveryCost = roundRetailOrderMoney(input.order.deliveryCost);
  if (deliveryFee < 0 || deliveryCost < 0) {
    throw new Error('Taxas de entrega do pedido são inválidas.');
  }
  const faturamentoTotal = roundRetailOrderMoney(faturamentoProdutos + deliveryFee);
  const custoProdutos = roundRetailOrderMoney(
    input.order.lineItems.reduce((total, lineItem) => total + lineItem.lineCostTotal, 0),
  );
  const custoEntregas = deliveryCost;
  const postedPayments = (input.payments ?? []).filter(
    (payment) =>
      payment.status === 'posted' && Number.isFinite(payment.amount) && payment.amount >= 0,
  );
  const recebido = roundRetailOrderMoney(
    postedPayments.reduce((total, payment) => total + payment.amount, 0),
  );
  const taxasCartao = roundRetailOrderMoney(
    postedPayments.reduce(
      (total, payment) =>
        total +
        (Number.isFinite(payment.cardFee) && (payment.cardFee ?? 0) >= 0
          ? (payment.cardFee ?? 0)
          : 0),
      0,
    ),
  );
  const otherDirectCosts = roundRetailOrderMoney(input.otherDirectCosts ?? 0);
  if (otherDirectCosts < 0) {
    throw new Error('Outros custos diretos devem ser zero ou maiores.');
  }
  const totalCharged = faturamentoTotal;
  const aReceber = roundRetailOrderMoney(Math.max(0, totalCharged - recebido));
  const resultadoEntregas = roundRetailOrderMoney(deliveryFee - custoEntregas);
  const lucroBrutoProdutos = roundRetailOrderMoney(faturamentoProdutos - custoProdutos);
  const lucroLiquido = roundRetailOrderMoney(
    faturamentoProdutos +
      deliveryFee -
      custoProdutos -
      custoEntregas -
      taxasCartao -
      otherDirectCosts,
  );
  const paidAmount = recebido;
  const outstandingAmount = aReceber;
  return {
    aReceber,
    recebido,
    custoEntregas,
    custoProdutos,
    deliveryCost,
    deliveryFee,
    discount,
    faturamentoProdutos,
    faturamentoTotal,
    financialStatus: financialStatusFor(totalCharged, paidAmount),
    lucroBrutoProdutos,
    lucroLiquido,
    outstandingAmount,
    paidAmount,
    resultadoEntregas,
    subtotalProducts,
    taxasCartao,
    totalCharged,
  };
}
