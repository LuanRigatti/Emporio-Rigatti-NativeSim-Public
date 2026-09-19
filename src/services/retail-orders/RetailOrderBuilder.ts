import type {
  RetailCategory,
  RetailCompositionVersion,
  RetailCostEntry,
  RetailCostItem,
  RetailOrder,
  RetailOrderCreateInput,
  RetailOrderLineItem,
  RetailOrderLineItemInput,
  RetailProduct,
  RetailProductCostResolution,
} from '@/types/data';
import { resolveRetailProductCost } from '@/services/retail-costs/RetailProductCostResolver';
import { retailFinanceGroupForCategory } from '@/services/retail-catalog/retailFinanceGroup';
import {
  normalizeRetailDate,
  normalizeRetailMoney,
  normalizeRetailQuantity,
} from '@/services/retail-costs/retailCostUtils';

import {
  allocateDiscountCents,
  centsToMoney,
  moneyToCents,
  optionalRetailOrderText,
  roundRetailOrderMoney,
} from './retailOrderUtils';

export type RetailOrderCatalogContext = {
  products: readonly RetailProduct[];
  categories?: readonly RetailCategory[];
  costItems: readonly RetailCostItem[];
  costEntriesByItemId: ReadonlyMap<string, readonly RetailCostEntry[]>;
  compositionVersionsByProductId?: ReadonlyMap<string, readonly RetailCompositionVersion[]>;
};

export type RetailOrderWriteData = Omit<RetailOrder, 'createdAt' | 'updatedAt'>;

export type RetailOrderLineItemEditInput = RetailOrderLineItemInput;

export type RetailOrderLineItemsUpdate = {
  deliveryFee: number;
  discount: number;
  lineItems: readonly RetailOrderLineItem[];
  subtotalProducts: number;
  totalCharged: number;
};

export type RetailOrderValidationCode =
  | 'invalid_order_id'
  | 'invalid_client'
  | 'invalid_snapshot'
  | 'invalid_line_items'
  | 'product_not_found'
  | 'product_inactive'
  | 'category_snapshot_missing'
  | 'composition_snapshot_missing';

export class RetailOrderValidationError extends Error {
  public readonly code: RetailOrderValidationCode;

  public constructor(code: RetailOrderValidationCode, message: string) {
    super(message);
    this.name = 'RetailOrderValidationError';
    this.code = code;
    Object.setPrototypeOf(this, RetailOrderValidationError.prototype);
  }
}

export class RetailOrderCostError extends Error {
  public readonly resolution: Exclude<RetailProductCostResolution, { status: 'available' }>;

  public constructor(resolution: Exclude<RetailProductCostResolution, { status: 'available' }>) {
    super(resolution.message);
    this.name = 'RetailOrderCostError';
    this.resolution = resolution;
    Object.setPrototypeOf(this, RetailOrderCostError.prototype);
  }
}

function assertId(value: string, code: RetailOrderValidationCode, message: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.includes('/')) throw new RetailOrderValidationError(code, message);
  return normalized;
}

function snapshotForProduct(
  product: RetailProduct,
  context: RetailOrderCatalogContext,
): {
  categoryIdSnapshot: string;
  categorySnapshot: string;
  financeGroupSnapshot: RetailOrderLineItem['financeGroupSnapshot'];
} {
  const category = context.categories?.find(
    (candidate) => candidate.categoryId === product.categoryId,
  );
  const categorySnapshot =
    optionalRetailOrderText(category?.label) ?? optionalRetailOrderText(product.categoryName);
  if (!categorySnapshot) {
    throw new RetailOrderValidationError(
      'category_snapshot_missing',
      `A categoria do produto ${product.productId} não possui snapshot válido.`,
    );
  }
  return {
    categoryIdSnapshot: product.categoryId,
    categorySnapshot,
    financeGroupSnapshot: retailFinanceGroupForCategory(category ?? { label: categorySnapshot }),
  };
}

function costBreakdownSnapshotFor(
  resolution: Extract<RetailProductCostResolution, { status: 'available' }>,
): RetailOrderLineItem['costBreakdownSnapshot'] {
  return resolution.breakdown.map((component) => ({
    costItemId: component.costItemId,
    costItemNameSnapshot: component.costItemName,
    effectiveDate: component.effectiveDate,
    quantity: component.quantity,
    totalCostSnapshot: roundRetailOrderMoney(component.totalCost),
    unit: component.unit,
    unitCostSnapshot: roundRetailOrderMoney(component.unitCost),
  }));
}

function compositionSnapshotFor(
  resolution: Extract<RetailProductCostResolution, { status: 'available' }>,
  context: RetailOrderCatalogContext,
): RetailOrderLineItem['compositionVersionSnapshot'] {
  if (!resolution.compositionVersionId) return undefined;
  const version = [...(context.compositionVersionsByProductId?.values() ?? [])]
    .flat()
    .find((candidate) => candidate.compositionVersionId === resolution.compositionVersionId);
  if (!version) {
    throw new RetailOrderValidationError(
      'composition_snapshot_missing',
      'A versão de composição resolvida não está disponível para congelar o snapshot.',
    );
  }
  return {
    compositionVersionId: version.compositionVersionId,
    components: costBreakdownSnapshotFor(resolution),
    effectiveFrom: version.effectiveFrom,
  };
}

function buildLineItem(
  input: RetailOrderCreateInput['lineItems'][number],
  orderDate: string,
  context: RetailOrderCatalogContext,
): RetailOrderLineItem {
  const productId = assertId(
    input.productId,
    'invalid_line_items',
    'O item do pedido possui um produto inválido.',
  );
  const product = context.products.find((candidate) => candidate.productId === productId);
  if (!product) {
    throw new RetailOrderValidationError(
      'product_not_found',
      `O produto ${productId} não foi encontrado no catálogo Varejo.`,
    );
  }
  if (!product.active) {
    throw new RetailOrderValidationError(
      'product_inactive',
      `O produto ${product.productName} está inativo e não pode entrar em um novo pedido.`,
    );
  }
  const quantity = normalizeRetailQuantity(input.quantity, 'A quantidade do produto');
  const unitSalePriceSnapshot = normalizeRetailMoney(
    product.standardSalePrice,
    'O preço de venda do produto',
  );
  const lineSubtotal = roundRetailOrderMoney(quantity * unitSalePriceSnapshot);
  const { categoryIdSnapshot, categorySnapshot, financeGroupSnapshot } = snapshotForProduct(
    product,
    context,
  );
  const resolution = resolveRetailProductCost({
    compositionVersions: context.compositionVersionsByProductId?.get(product.productId) ?? [],
    costEntriesByItemId: context.costEntriesByItemId,
    costItems: context.costItems,
    product,
    referenceDate: orderDate,
  });
  if (resolution.status !== 'available') throw new RetailOrderCostError(resolution);

  const costBreakdownSnapshot = costBreakdownSnapshotFor(resolution);
  const unitCostSnapshot = roundRetailOrderMoney(resolution.cost);
  const lineCostTotal = roundRetailOrderMoney(unitCostSnapshot * quantity);
  return {
    categoryIdSnapshot,
    categorySnapshot,
    financeGroupSnapshot,
    ...(optionalRetailOrderText(product.flavor)
      ? { flavorSnapshot: optionalRetailOrderText(product.flavor) }
      : {}),
    lineCostTotal,
    lineSubtotal,
    costBreakdownSnapshot,
    ...(optionalRetailOrderText(product.packageSize)
      ? { packageSizeSnapshot: optionalRetailOrderText(product.packageSize) }
      : {}),
    productId: product.productId,
    productNameSnapshot: product.productName.trim(),
    quantity,
    ...(optionalRetailOrderText(product.variant)
      ? { variantSnapshot: optionalRetailOrderText(product.variant) }
      : {}),
    unitCostSnapshot,
    unitSalePriceSnapshot,
    ...(resolution.compositionVersionId
      ? { compositionVersionSnapshot: compositionSnapshotFor(resolution, context) }
      : {}),
    discountAllocatedSnapshot: 0,
  };
}

export function buildRetailOrderLineItem(
  input: RetailOrderLineItemEditInput,
  orderDate: string,
  context: RetailOrderCatalogContext,
): RetailOrderLineItem {
  return buildLineItem(input, normalizeRetailDate(orderDate), context);
}

export function buildRetailOrderLineItemsUpdate(
  order: Pick<RetailOrder, 'orderDate' | 'discount' | 'deliveryFee' | 'lineItems'>,
  inputs: readonly RetailOrderLineItemEditInput[],
  context?: RetailOrderCatalogContext,
  overrides: Partial<Pick<RetailOrder, 'discount' | 'deliveryFee'>> = {},
): RetailOrderLineItemsUpdate {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new RetailOrderValidationError(
      'invalid_line_items',
      'O pedido precisa manter ao menos um produto.',
    );
  }

  const quantitiesByProductId = new Map<string, number>();
  for (const input of inputs) {
    const productId = assertId(
      input.productId,
      'invalid_line_items',
      'O item do pedido possui um produto inválido.',
    );
    const quantity = normalizeRetailQuantity(input.quantity, 'A quantidade do produto');
    quantitiesByProductId.set(productId, (quantitiesByProductId.get(productId) ?? 0) + quantity);
  }

  const existingByProductId = new Map(
    order.lineItems.map((lineItem) => [lineItem.productId, lineItem] as const),
  );
  const lineItems = [...quantitiesByProductId].map(([productId, quantity]) => {
    const existing = existingByProductId.get(productId);
    if (existing) {
      return {
        ...existing,
        lineCostTotal: roundRetailOrderMoney(quantity * existing.unitCostSnapshot),
        lineSubtotal: roundRetailOrderMoney(quantity * existing.unitSalePriceSnapshot),
        quantity,
      };
    }
    if (!context) {
      throw new RetailOrderValidationError(
        'product_not_found',
        'O catálogo é necessário para adicionar um produto novo ao pedido.',
      );
    }
    return buildRetailOrderLineItem({ productId, quantity }, order.orderDate, context);
  });

  const subtotalProducts = centsToMoney(
    lineItems.reduce((total, lineItem) => total + moneyToCents(lineItem.lineSubtotal), 0),
  );
  const discount = normalizeRetailMoney(overrides.discount ?? order.discount, 'O desconto');
  if (moneyToCents(discount) > moneyToCents(subtotalProducts)) {
    throw new Error('O desconto não pode superar o subtotal do pedido.');
  }
  const deliveryFee = normalizeRetailMoney(
    overrides.deliveryFee ?? order.deliveryFee,
    'A taxa de entrega',
  );
  const discountAllocations = allocateDiscountCents(
    lineItems.map((lineItem) => moneyToCents(lineItem.lineSubtotal)),
    moneyToCents(discount),
  );
  const nextLineItems = lineItems.map((lineItem, index) => ({
    ...lineItem,
    discountAllocatedSnapshot: centsToMoney(discountAllocations[index] ?? 0),
  }));

  return {
    deliveryFee,
    discount,
    lineItems: nextLineItems,
    subtotalProducts,
    totalCharged: centsToMoney(
      moneyToCents(subtotalProducts) - moneyToCents(discount) + moneyToCents(deliveryFee),
    ),
  };
}

export function buildRetailOrderWriteData(
  orderId: string,
  input: RetailOrderCreateInput,
  context: RetailOrderCatalogContext,
): RetailOrderWriteData {
  const normalizedOrderId = assertId(orderId, 'invalid_order_id', 'ID de pedido Varejo inválido.');
  const clientId = assertId(
    input.clientId,
    'invalid_client',
    'O pedido precisa de um cliente Varejo válido.',
  );
  const clientNameSnapshot = optionalRetailOrderText(input.clientNameSnapshot);
  if (!clientNameSnapshot) {
    throw new RetailOrderValidationError(
      'invalid_snapshot',
      'O pedido precisa guardar o nome do cliente.',
    );
  }
  if (!Array.isArray(input.lineItems) || input.lineItems.length === 0) {
    throw new RetailOrderValidationError(
      'invalid_line_items',
      'Adicione ao menos um produto ao pedido.',
    );
  }
  const orderDate = normalizeRetailDate(input.orderDate);
  const deliveryDate = normalizeRetailDate(input.deliveryDate);
  const lineItems = input.lineItems.map((lineItem) => buildLineItem(lineItem, orderDate, context));
  const lineSubtotalsCents = lineItems.map((lineItem) => moneyToCents(lineItem.lineSubtotal));
  const subtotalCents = lineSubtotalsCents.reduce((total, value) => total + value, 0);
  const subtotalProducts = centsToMoney(subtotalCents);
  const discount = normalizeRetailMoney(input.discount, 'O desconto');
  const discountCents = moneyToCents(discount);
  if (discountCents > subtotalCents) throw new Error('O desconto não pode superar o subtotal.');
  const discountAllocations = allocateDiscountCents(lineSubtotalsCents, discountCents);
  const deliveryFee = normalizeRetailMoney(input.deliveryFee, 'A taxa de entrega');
  const deliveryCost = normalizeRetailMoney(input.deliveryCost, 'O custo da entrega');
  const totalCharged = centsToMoney(subtotalCents - discountCents + moneyToCents(deliveryFee));
  return {
    clientId,
    clientNameSnapshot,
    ...(optionalRetailOrderText(input.clientPhoneSnapshot)
      ? { clientPhoneSnapshot: optionalRetailOrderText(input.clientPhoneSnapshot) }
      : {}),
    ...(optionalRetailOrderText(input.clientAddressSnapshot)
      ? { clientAddressSnapshot: optionalRetailOrderText(input.clientAddressSnapshot) }
      : {}),
    deliveryAddressSnapshot: input.deliveryAddressSnapshot.trim(),
    deliveryCost,
    deliveryDate,
    deliveryFee,
    ...(optionalRetailOrderText(input.notes)
      ? { notes: optionalRetailOrderText(input.notes) }
      : {}),
    discount,
    lineItems: lineItems.map((lineItem, index) => ({
      ...lineItem,
      discountAllocatedSnapshot: centsToMoney(discountAllocations[index] ?? 0),
    })),
    ...(optionalRetailOrderText(input.occasion)
      ? { occasion: optionalRetailOrderText(input.occasion) }
      : {}),
    orderDate,
    orderId: normalizedOrderId,
    status: 'created',
    subtotalProducts,
    totalCharged,
    ...(optionalRetailOrderText(input.recipient)
      ? { recipient: optionalRetailOrderText(input.recipient) }
      : {}),
  };
}
