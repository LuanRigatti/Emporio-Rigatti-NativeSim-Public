import type {
  FirestoreTimestamp,
  RetailCategory,
  RetailCompositionVersion,
  RetailCostEntry,
  RetailCostItem,
  RetailProduct,
} from '@/types/data';
import {
  buildRetailOrderLineItemsUpdate,
  buildRetailOrderWriteData,
  RetailOrderCostError,
  type RetailOrderCatalogContext,
} from '@/services/retail-orders/RetailOrderBuilder';

const timestamp = { nanoseconds: 0, seconds: 1 } as FirestoreTimestamp;

function category(): RetailCategory {
  return {
    active: true,
    categoryId: 'cat-baskets',
    createdAt: timestamp,
    label: 'Cestas',
    normalizedLabel: 'cestas',
    updatedAt: timestamp,
  };
}

function costItem(costItemId: string, name: string, unit = 'unidade'): RetailCostItem {
  return {
    active: true,
    costItemId,
    createdAt: timestamp,
    name,
    normalizedName: name.toLowerCase(),
    unit,
    updatedAt: timestamp,
  };
}

function costEntry(
  entryId: string,
  effectiveDate: string,
  normalizedUnitCost: number,
  unit = 'unidade',
): RetailCostEntry {
  return {
    createdAt: timestamp,
    effectiveDate,
    entryId,
    normalizedUnitCost,
    purchaseTotalCost: normalizedUnitCost,
    purchasedQuantity: 1,
    unit,
  };
}

function product(
  productId: string,
  standardSalePrice: number,
  overrides: Partial<RetailProduct> = {},
): RetailProduct {
  return {
    active: true,
    categoryId: 'cat-baskets',
    createdAt: timestamp,
    productId,
    productName: `Produto ${productId}`,
    standardSalePrice,
    updatedAt: timestamp,
    ...overrides,
  };
}

function directContext(
  products: readonly RetailProduct[],
  item: RetailCostItem,
  entries: readonly RetailCostEntry[],
): RetailOrderCatalogContext {
  return {
    categories: [category()],
    costEntriesByItemId: new Map([[item.costItemId, entries]]),
    costItems: [item],
    products,
  };
}

function orderInput(lineItems: readonly { productId: string; quantity: number }[]) {
  return {
    clientId: 'retail-client-1',
    clientNameSnapshot: 'Cliente Varejo',
    clientPhoneSnapshot: '51999999999',
    deliveryAddressSnapshot: 'Rua A, 10',
    deliveryCost: 5,
    deliveryDate: '2026-02-10',
    deliveryFee: 20,
    discount: 0,
    lineItems,
    orderDate: '2026-02-01',
  };
}

describe('buildRetailOrderWriteData', () => {
  it('freezes direct product price/cost snapshots using the order date', () => {
    const item = costItem('basket', 'Cesta');
    const result = buildRetailOrderWriteData(
      'order-1',
      orderInput([{ productId: 'product-1', quantity: 2 }]),
      directContext(
        [
          product('product-1', 10, {
            costMode: 'direct',
            directCostItemId: item.costItemId,
            productName: 'Cesta Café',
          }),
        ],
        item,
        [costEntry('old', '2026-01-01', 4), costEntry('future', '2026-03-01', 8)],
      ),
    );

    expect(result).toMatchObject({
      orderId: 'order-1',
      status: 'created',
      subtotalProducts: 20,
      totalCharged: 40,
    });
    expect(result.lineItems[0]).toMatchObject({
      financeGroupSnapshot: 'baskets',
      lineCostTotal: 8,
      productNameSnapshot: 'Cesta Café',
      unitCostSnapshot: 4,
    });
    expect(result.lineItems[0]?.costBreakdownSnapshot).toEqual([
      expect.objectContaining({ effectiveDate: '2026-01-01', unitCostSnapshot: 4 }),
    ]);
  });

  it('freezes the valid composition version and every component cost', () => {
    const basket = costItem('basket', 'Cesta');
    const coffee = costItem('coffee', 'Café');
    const oldVersion: RetailCompositionVersion = {
      active: true,
      components: [
        {
          costItemId: basket.costItemId,
          costItemNameSnapshot: basket.name,
          quantity: 1,
          unit: basket.unit,
        },
        {
          costItemId: coffee.costItemId,
          costItemNameSnapshot: coffee.name,
          quantity: 2,
          unit: coffee.unit,
        },
      ],
      compositionVersionId: 'composition-v1',
      createdAt: timestamp,
      effectiveFrom: '2026-01-01',
      productId: 'product-1',
    };
    const futureVersion: RetailCompositionVersion = {
      ...oldVersion,
      components: [{ ...oldVersion.components[0], quantity: 3 }],
      compositionVersionId: 'composition-v2',
      effectiveFrom: '2026-03-01',
    };
    const result = buildRetailOrderWriteData(
      'order-1',
      orderInput([{ productId: 'product-1', quantity: 2 }]),
      {
        categories: [category()],
        compositionVersionsByProductId: new Map([
          [oldVersion.productId, [oldVersion, futureVersion]],
        ]),
        costEntriesByItemId: new Map([
          [basket.costItemId, [costEntry('basket-entry', '2026-01-01', 5)]],
          [coffee.costItemId, [costEntry('coffee-entry', '2026-01-01', 3)]],
        ]),
        costItems: [basket, coffee],
        products: [
          product('product-1', 30, {
            costMode: 'composition',
            productName: 'Cesta Café Portugal',
          }),
        ],
      },
    );

    expect(result.lineItems[0]).toMatchObject({ lineCostTotal: 22, unitCostSnapshot: 11 });
    expect(result.lineItems[0]?.financeGroupSnapshot).toBe('baskets');
    expect(result.lineItems[0]?.compositionVersionSnapshot).toMatchObject({
      compositionVersionId: 'composition-v1',
      effectiveFrom: '2026-01-01',
    });
    expect(result.lineItems[0]?.compositionVersionSnapshot?.components).toEqual([
      expect.objectContaining({ costItemId: 'basket', unitCostSnapshot: 5 }),
      expect.objectContaining({ costItemId: 'coffee', quantity: 2, unitCostSnapshot: 3 }),
    ]);
  });

  it('raises a typed error instead of silently using zero for unavailable cost', () => {
    const item = costItem('basket', 'Cesta');

    expect(() =>
      buildRetailOrderWriteData(
        'order-1',
        orderInput([{ productId: 'product-1', quantity: 1 }]),
        directContext(
          [
            product('product-1', 10, {
              costMode: 'direct',
              directCostItemId: item.costItemId,
            }),
          ],
          item,
          [costEntry('future', '2026-03-01', 8)],
        ),
      ),
    ).toThrow(RetailOrderCostError);

    try {
      buildRetailOrderWriteData(
        'order-1',
        orderInput([{ productId: 'product-1', quantity: 1 }]),
        directContext(
          [
            product('product-1', 10, {
              costMode: 'direct',
              directCostItemId: item.costItemId,
            }),
          ],
          item,
          [costEntry('future', '2026-03-01', 8)],
        ),
      );
    } catch (error) {
      expect(error).toBeInstanceOf(RetailOrderCostError);
      expect((error as RetailOrderCostError).resolution).toMatchObject({
        reason: 'no_cost_before_date',
        status: 'unavailable',
      });
    }
  });

  it('allocates an order discount exactly in cents across line-item snapshots', () => {
    const item = costItem('unit', 'Unidade');
    const products = ['a', 'b', 'c'].map((id) =>
      product(id, 10, { costMode: 'direct', directCostItemId: item.costItemId }),
    );
    const result = buildRetailOrderWriteData(
      'order-1',
      {
        ...orderInput(products.map((item) => ({ productId: item.productId, quantity: 1 }))),
        discount: 0.05,
      },
      directContext(products, item, [costEntry('unit-entry', '2026-01-01', 1)]),
    );

    const allocations = result.lineItems.map((lineItem) => lineItem.discountAllocatedSnapshot);
    expect(allocations).toEqual([0.02, 0.02, 0.01]);
    expect(allocations.reduce((total, value) => total + value, 0)).toBe(0.05);
    expect(result.totalCharged).toBe(49.95);
  });

  it('preserves existing snapshots while recalculating quantity-derived values', () => {
    const item = costItem('unit', 'Unidade');
    const original = buildRetailOrderWriteData(
      'order-1',
      orderInput([{ productId: 'product-1', quantity: 1 }]),
      directContext(
        [product('product-1', 10, { costMode: 'direct', directCostItemId: item.costItemId })],
        item,
        [costEntry('unit-entry', '2026-01-01', 4)],
      ),
    );

    const result = buildRetailOrderLineItemsUpdate(original, [
      { productId: 'product-1', quantity: 3 },
    ]);

    expect(result.lineItems[0]).toMatchObject({
      costBreakdownSnapshot: original.lineItems[0]?.costBreakdownSnapshot,
      lineCostTotal: 12,
      lineSubtotal: 30,
      productNameSnapshot: original.lineItems[0]?.productNameSnapshot,
      quantity: 3,
      unitCostSnapshot: 4,
      unitSalePriceSnapshot: 10,
    });
    expect(result.subtotalProducts).toBe(30);
    expect(result.totalCharged).toBe(50);
  });

  it('builds a new line from the current active catalog using the order date', () => {
    const item = costItem('unit', 'Unidade');
    const existingProduct = product('product-1', 10, {
      costMode: 'direct',
      directCostItemId: item.costItemId,
    });
    const newProduct = product('product-2', 15, {
      costMode: 'direct',
      directCostItemId: item.costItemId,
    });
    const original = buildRetailOrderWriteData(
      'order-1',
      orderInput([{ productId: existingProduct.productId, quantity: 1 }]),
      directContext([existingProduct, newProduct], item, [
        costEntry('unit-entry', '2026-01-01', 4),
      ]),
    );

    const result = buildRetailOrderLineItemsUpdate(
      original,
      [
        { productId: existingProduct.productId, quantity: 1 },
        { productId: newProduct.productId, quantity: 2 },
      ],
      directContext([existingProduct, newProduct], item, [
        costEntry('unit-entry', '2026-01-01', 4),
      ]),
    );

    expect(result.lineItems[1]).toMatchObject({
      financeGroupSnapshot: 'baskets',
      lineCostTotal: 8,
      lineSubtotal: 30,
      productId: 'product-2',
      productNameSnapshot: 'Produto product-2',
      quantity: 2,
      unitCostSnapshot: 4,
      unitSalePriceSnapshot: 15,
    });
  });

  it('rejects removing the final line and blocks a discount above the new subtotal', () => {
    const item = costItem('unit', 'Unidade');
    const original = buildRetailOrderWriteData(
      'order-1',
      orderInput([{ productId: 'product-1', quantity: 1 }]),
      directContext(
        [product('product-1', 10, { costMode: 'direct', directCostItemId: item.costItemId })],
        item,
        [costEntry('unit-entry', '2026-01-01', 4)],
      ),
    );

    expect(() => buildRetailOrderLineItemsUpdate(original, [])).toThrow(
      'O pedido precisa manter ao menos um produto.',
    );
    expect(() =>
      buildRetailOrderLineItemsUpdate(
        original,
        [{ productId: 'product-1', quantity: 1 }],
        undefined,
        {
          discount: 11,
        },
      ),
    ).toThrow('O desconto não pode superar o subtotal do pedido.');
  });

  it('consolidates duplicate product inputs and rejects an inactive new product', () => {
    const item = costItem('unit', 'Unidade');
    const existing = product('product-1', 10, {
      costMode: 'direct',
      directCostItemId: item.costItemId,
    });
    const inactive = product('product-inactive', 12, {
      active: false,
      costMode: 'direct',
      directCostItemId: item.costItemId,
    });
    const context = directContext([existing, inactive], item, [
      costEntry('unit-entry', '2026-01-01', 4),
    ]);
    const original = buildRetailOrderWriteData(
      'order-1',
      orderInput([{ productId: existing.productId, quantity: 1 }]),
      context,
    );

    const consolidated = buildRetailOrderLineItemsUpdate(original, [
      { productId: existing.productId, quantity: 1 },
      { productId: existing.productId, quantity: 2 },
    ]);
    expect(consolidated.lineItems).toHaveLength(1);
    expect(consolidated.lineItems[0]?.quantity).toBe(3);

    expect(() =>
      buildRetailOrderLineItemsUpdate(
        original,
        [{ productId: inactive.productId, quantity: 1 }],
        context,
      ),
    ).toThrow('está inativo');
  });
});
