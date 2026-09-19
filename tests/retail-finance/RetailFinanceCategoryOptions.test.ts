import type { FirestoreTimestamp, RetailCategory, RetailOrder } from '@/types/data';
import {
  buildRetailFinanceCategoryOptions,
  retailFinanceCategoryIdFromView,
  retailFinanceViewForCategory,
} from '@/services/retail-finance';

const timestamp = { nanoseconds: 0, seconds: 1 } as FirestoreTimestamp;

function category(categoryId: string, label: string, active = true): RetailCategory {
  return {
    active,
    categoryId,
    createdAt: timestamp,
    label,
    normalizedLabel: label.toLowerCase(),
    updatedAt: timestamp,
  };
}

function order(
  lines: readonly { categoryIdSnapshot: string; categorySnapshot: string }[],
): RetailOrder {
  return {
    clientId: 'client-1',
    clientNameSnapshot: 'Cliente',
    createdAt: timestamp,
    deliveryAddressSnapshot: 'Rua A, 1',
    deliveryCost: 0,
    deliveryDate: '2026-09-18',
    deliveryFee: 0,
    discount: 0,
    lineItems: lines.map((line, index) => ({
      categoryIdSnapshot: line.categoryIdSnapshot,
      categorySnapshot: line.categorySnapshot,
      costBreakdownSnapshot: [],
      discountAllocatedSnapshot: 0,
      lineCostTotal: 1,
      lineSubtotal: 2,
      productId: `product-${index}`,
      productNameSnapshot: `Produto ${index}`,
      quantity: 1,
      unitCostSnapshot: 1,
      unitSalePriceSnapshot: 2,
    })),
    orderDate: '2026-09-18',
    orderId: 'order-1',
    status: 'created',
    subtotalProducts: 2,
    totalCharged: 2,
    updatedAt: timestamp,
  };
}

describe('Retail Finance category views', () => {
  it('unions active current categories with historical snapshot IDs, including empty categories', () => {
    const options = buildRetailFinanceCategoryOptions(
      [category('new-category', 'Teste'), category('renamed', 'Nome atual')],
      [
        order([
          { categoryIdSnapshot: 'renamed', categorySnapshot: 'Nome antigo' },
          { categoryIdSnapshot: 'removed-category', categorySnapshot: 'Categoria antiga' },
        ]),
      ],
    );

    expect(options).toEqual([
      { categoryId: 'new-category', label: 'Teste' },
      { categoryId: 'renamed', label: 'Nome atual' },
      { categoryId: 'removed-category', label: 'Categoria antiga' },
    ]);
  });

  it('keeps homonymous categories distinct by ID and excludes inactive categories without history', () => {
    const options = buildRetailFinanceCategoryOptions(
      [
        category('same-name-a', 'Teste'),
        category('same-name-b', 'Teste'),
        category('inactive-empty', 'Inativa', false),
      ],
      [],
    );

    expect(options).toEqual([
      { categoryId: 'same-name-a', label: 'Teste' },
      { categoryId: 'same-name-b', label: 'Teste' },
    ]);
  });

  it('uses the current label for an inactive category when historical movement keeps it visible', () => {
    const options = buildRetailFinanceCategoryOptions(
      [category('inactive-with-history', 'Nome atual', false)],
      [order([{ categoryIdSnapshot: 'inactive-with-history', categorySnapshot: 'Nome antigo' }])],
    );

    expect(options).toEqual([{ categoryId: 'inactive-with-history', label: 'Nome atual' }]);
  });

  it('uses category IDs in cache/view identities, never labels', () => {
    expect(retailFinanceViewForCategory('same-name-a')).toBe('category:same-name-a');
    expect(retailFinanceViewForCategory('same-name-b')).toBe('category:same-name-b');
    expect(retailFinanceCategoryIdFromView('category:same-name-a')).toBe('same-name-a');
    expect(retailFinanceCategoryIdFromView('category:same-name-b')).toBe('same-name-b');
    expect(retailFinanceCategoryIdFromView('general')).toBeUndefined();
  });
});
