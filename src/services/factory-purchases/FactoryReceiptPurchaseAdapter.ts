import type { FactoryPayment, FactoryReceipt } from '@/types/data';

import type { Purchase, PurchasePayment } from '@/features/factory-purchases/types';

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function totalPaid(payments: readonly FactoryPayment[]): number {
  return payments.reduce((total, payment) => total + Math.max(0, payment.valor), 0);
}

export function factoryReceiptToPurchase(receipt: FactoryReceipt): Purchase {
  const quantity = Math.max(0, Math.round(receipt.quantidade));
  const totalAmount = roundMoney(receipt.valorTotal);

  return {
    id: receipt.id,
    date: receipt.data,
    bucketQuantity: quantity,
    bucketUnitPrice:
      receipt.precoUnitarioHistorico ?? (quantity > 0 ? roundMoney(totalAmount / quantity) : 0),
    totalAmount,
    payments: receipt.pagamentos.map<PurchasePayment>((payment) => ({
      id: payment.id,
      date: payment.data,
      amount: roundMoney(payment.valor),
    })),
  };
}

export function factoryReceiptsToPurchases(receipts: readonly FactoryReceipt[]): Purchase[] {
  return receipts.map(factoryReceiptToPurchase);
}

export function purchaseToFactoryReceipt(purchase: Purchase): FactoryReceipt {
  const payments: FactoryPayment[] = purchase.payments.map((payment) => ({
    id: payment.id,
    data: payment.date,
    valor: roundMoney(payment.amount),
  }));
  const total = roundMoney(purchase.totalAmount);

  return {
    id: purchase.id,
    quantidade: Math.max(0, Math.round(purchase.bucketQuantity)),
    data: purchase.date,
    precoUnitarioHistorico: roundMoney(purchase.bucketUnitPrice),
    valorTotal: total,
    concluido: Math.abs(total - totalPaid(payments)) < 0.01,
    pagamentos: payments,
  };
}
