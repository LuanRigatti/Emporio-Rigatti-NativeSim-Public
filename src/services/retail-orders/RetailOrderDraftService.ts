import type {
  RetailClient,
  RetailOrderCreateInput,
  RetailPaymentDraft,
  RetailPaymentMethod,
  RetailProduct,
} from '@/types/data';
import {
  normalizeRetailDate,
  normalizeRetailMoney,
  normalizeRetailQuantity,
} from '@/services/retail-costs/retailCostUtils';

import {
  centsToMoney,
  moneyToCents,
  optionalRetailOrderText,
  roundRetailOrderMoney,
} from './retailOrderUtils';

export type RetailOrderDraftLine = {
  productId: string;
  quantity: string;
};

export type RetailOrderDraftValues = {
  clientId: string;
  lineItems: readonly RetailOrderDraftLine[];
  orderDate: string;
  deliveryDate: string;
  deliveryAddressSnapshot: string;
  occasion: string;
  recipient: string;
  discount: string;
  deliveryFee: string;
  deliveryCost: string;
  notes: string;
};

export type RetailOrderDraftLineTotal = {
  productId: string;
  quantity: number;
  unitSalePrice: number;
  lineSubtotal: number;
};

export type RetailOrderDraftTotals = {
  lines: readonly RetailOrderDraftLineTotal[];
  subtotalProducts: number;
  discount: number;
  deliveryFee: number;
  totalCharged: number;
};

export type RetailInitialPaymentValues = {
  amount: string;
  paidAt: string;
  method: RetailPaymentMethod;
  cardFee: string;
  notes: string;
};

export type RetailInitialPaymentPreview = {
  amount: number;
  outstandingAmount: number;
};

export const RETAIL_PAYMENT_METHOD_OPTIONS = [
  { label: 'Pix', value: 'Pix' },
  { label: 'Dinheiro', value: 'Dinheiro' },
  { label: 'Crédito', value: 'Crédito' },
  { label: 'Débito', value: 'Débito' },
  { label: 'Outro', value: 'Outro' },
] as const satisfies readonly { label: string; value: RetailPaymentMethod }[];

export function calculateRetailOrderDraftTotals(input: {
  lineItems: readonly RetailOrderDraftLine[];
  products: readonly RetailProduct[];
  discount: string;
  deliveryFee: string;
}): RetailOrderDraftTotals {
  if (!input.lineItems.length) {
    throw new Error('Adicione ao menos um produto ao pedido.');
  }

  const productById = new Map(input.products.map((product) => [product.productId, product]));
  const lines = input.lineItems.map((lineItem) => {
    const product = productById.get(lineItem.productId);
    if (!product) throw new Error('Um produto selecionado não está mais disponível.');
    if (!product.active) {
      throw new Error(`O produto ${product.productName} está inativo.`);
    }
    const quantity = normalizeRetailQuantity(lineItem.quantity, 'A quantidade do produto');
    const unitSalePrice = normalizeRetailMoney(product.standardSalePrice, 'O preço do produto');
    return {
      lineSubtotal: roundRetailOrderMoney(quantity * unitSalePrice),
      productId: product.productId,
      quantity,
      unitSalePrice,
    };
  });

  const subtotalProducts = centsToMoney(
    lines.reduce((total, line) => total + moneyToCents(line.lineSubtotal), 0),
  );
  const discount = normalizeRetailMoney(input.discount, 'O desconto');
  if (moneyToCents(discount) > moneyToCents(subtotalProducts)) {
    throw new Error('O desconto não pode superar o subtotal.');
  }
  const deliveryFee = normalizeRetailMoney(input.deliveryFee, 'A taxa de entrega');
  const totalCharged = centsToMoney(
    moneyToCents(subtotalProducts) - moneyToCents(discount) + moneyToCents(deliveryFee),
  );

  return { deliveryFee, discount, lines, subtotalProducts, totalCharged };
}

export function buildRetailOrderCreateInput(
  draft: RetailOrderDraftValues,
  client: RetailClient | undefined,
  products: readonly RetailProduct[],
): RetailOrderCreateInput {
  if (!client || client.clientId !== draft.clientId || !client.active) {
    throw new Error('Selecione um cliente Varejo ativo.');
  }
  const totals = calculateRetailOrderDraftTotals({
    deliveryFee: draft.deliveryFee,
    discount: draft.discount,
    lineItems: draft.lineItems,
    products,
  });
  const deliveryCost = normalizeRetailMoney(draft.deliveryCost, 'O custo da entrega');

  return {
    clientAddressSnapshot: optionalRetailOrderText(client.address),
    clientId: client.clientId,
    clientNameSnapshot: client.name,
    clientPhoneSnapshot: optionalRetailOrderText(client.phone),
    deliveryAddressSnapshot: draft.deliveryAddressSnapshot.trim(),
    deliveryCost,
    deliveryDate: normalizeRetailDate(draft.deliveryDate),
    deliveryFee: totals.deliveryFee,
    discount: totals.discount,
    lineItems: totals.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
    })),
    occasion: optionalRetailOrderText(draft.occasion),
    notes: optionalRetailOrderText(draft.notes),
    orderDate: normalizeRetailDate(draft.orderDate),
    recipient: optionalRetailOrderText(draft.recipient),
  };
}

export function buildRetailInitialPaymentDraft(
  values: RetailInitialPaymentValues,
  totalCharged: number,
): RetailPaymentDraft | undefined {
  if (!values.amount.trim()) return undefined;

  const amount = normalizeRetailMoney(values.amount, 'O pagamento');
  if (amount === 0) return undefined;
  if (amount < 0) throw new Error('O pagamento deve ser maior que zero.');
  if (amount > totalCharged) {
    throw new Error('O pagamento não pode superar o total cobrado.');
  }
  const cardFeeText = values.cardFee.trim();
  const cardFee = cardFeeText ? normalizeRetailMoney(cardFeeText, 'A taxa do cartão') : undefined;

  return {
    amount,
    ...(cardFee === undefined ? {} : { cardFee }),
    method: values.method,
    notes: optionalRetailOrderText(values.notes),
    paidAt: normalizeRetailDate(values.paidAt),
  };
}

export function calculateRetailInitialPaymentPreview(
  values: RetailInitialPaymentValues,
  totalCharged: number,
): RetailInitialPaymentPreview {
  const payment = buildRetailInitialPaymentDraft(values, totalCharged);
  const amount = payment?.amount ?? 0;

  return {
    amount,
    outstandingAmount: roundRetailOrderMoney(Math.max(0, totalCharged - amount)),
  };
}
