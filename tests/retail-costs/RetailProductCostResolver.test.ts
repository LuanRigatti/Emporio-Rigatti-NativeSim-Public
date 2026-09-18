import type {
  FirestoreTimestamp,
  RetailCompositionVersion,
  RetailCostEntry,
  RetailCostItem,
} from '@/types/data';
import { resolveRetailProductCost } from '@/services/retail-costs/RetailProductCostResolver';

const timestamp = { nanoseconds: 0, seconds: 1 } as FirestoreTimestamp;

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

function composition(
  compositionVersionId: string,
  effectiveFrom: string,
  components: RetailCompositionVersion['components'],
): RetailCompositionVersion {
  return {
    active: true,
    components,
    compositionVersionId,
    createdAt: timestamp,
    effectiveFrom,
    productId: 'product-1',
  };
}

describe('resolveRetailProductCost', () => {
  it('selects the latest direct cost effective on the reference date', () => {
    const item = costItem('coffee', 'Café');
    const result = resolveRetailProductCost({
      compositionVersions: [],
      costEntriesByItemId: new Map([
        [item.costItemId, [costEntry('old', '2026-01-01', 8), costEntry('new', '2026-02-01', 10)]],
      ]),
      costItems: [item],
      product: {
        costMode: 'direct',
        directCostItemId: item.costItemId,
        productId: 'product-1',
      },
      referenceDate: '2026-01-15',
    });

    expect(result).toMatchObject({
      cost: 8,
      status: 'available',
    });
    expect(result.status === 'available' ? result.breakdown[0]?.effectiveDate : undefined).toBe(
      '2026-01-01',
    );
  });

  it('does not assume zero when no historical cost exists before the date', () => {
    const item = costItem('coffee', 'Café');
    const result = resolveRetailProductCost({
      compositionVersions: [],
      costEntriesByItemId: new Map([[item.costItemId, [costEntry('future', '2026-02-01', 10)]]]),
      costItems: [item],
      product: {
        costMode: 'direct',
        directCostItemId: item.costItemId,
        productId: 'product-1',
      },
      referenceDate: '2026-01-15',
    });

    expect(result).toMatchObject({ reason: 'no_cost_before_date', status: 'unavailable' });
  });

  it('resolves a composition using the cost history valid on the same date', () => {
    const basket = costItem('basket', 'Cesta');
    const coffee = costItem('coffee', 'Café');
    const result = resolveRetailProductCost({
      compositionVersions: [
        composition('v1', '2026-01-01', [
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
        ]),
      ],
      costEntriesByItemId: new Map([
        [basket.costItemId, [costEntry('basket-entry', '2026-01-01', 5)]],
        [coffee.costItemId, [costEntry('coffee-entry', '2026-01-01', 3)]],
      ]),
      costItems: [basket, coffee],
      product: { costMode: 'composition', productId: 'product-1' },
      referenceDate: '2026-01-15',
    });

    expect(result).toMatchObject({
      compositionVersionId: 'v1',
      cost: 11,
      status: 'available',
    });
    expect(result.status === 'available' ? result.breakdown : []).toHaveLength(2);
  });

  it('resolves the replacement composition after removing a stale same-name component', () => {
    const validCroassaint = costItem('valid-croassaint', 'Croassaint');
    const drip = costItem('drip', 'Drip de Café Orfeu');
    const staleCroassaint = costItem('stale-croassaint', 'Croassaint');
    const oldVersion = composition('old-version', '2026-09-16', [
      {
        costItemId: validCroassaint.costItemId,
        costItemNameSnapshot: validCroassaint.name,
        quantity: 1,
        unit: validCroassaint.unit,
      },
      {
        costItemId: staleCroassaint.costItemId,
        costItemNameSnapshot: staleCroassaint.name,
        quantity: 1,
        unit: staleCroassaint.unit,
      },
    ]);
    const replacementVersion = composition('replacement-version', '2026-09-16', [
      {
        costItemId: validCroassaint.costItemId,
        costItemNameSnapshot: validCroassaint.name,
        quantity: 1,
        unit: validCroassaint.unit,
      },
      {
        costItemId: drip.costItemId,
        costItemNameSnapshot: drip.name,
        quantity: 1,
        unit: drip.unit,
      },
    ]);

    const result = resolveRetailProductCost({
      compositionVersions: [oldVersion, replacementVersion],
      costEntriesByItemId: new Map([
        [validCroassaint.costItemId, [costEntry('croassaint-entry', '2026-09-16', 1)]],
        [drip.costItemId, [costEntry('drip-entry', '2026-09-16', 4.9)]],
        [staleCroassaint.costItemId, []],
      ]),
      costItems: [validCroassaint, drip, staleCroassaint],
      product: { costMode: 'composition', productId: 'product-1' },
      referenceDate: '2026-09-18',
    });

    expect(result).toMatchObject({
      compositionVersionId: 'replacement-version',
      cost: 5.9,
      status: 'available',
    });
    expect(
      result.status === 'available' ? result.breakdown.map((item) => item.costItemId) : [],
    ).toEqual([validCroassaint.costItemId, drip.costItemId]);
  });

  it('keeps an old composition and cost resolution unchanged after future versions exist', () => {
    const basket = costItem('basket', 'Cesta');
    const oldVersion = composition('v1', '2026-01-01', [
      {
        costItemId: basket.costItemId,
        costItemNameSnapshot: basket.name,
        quantity: 1,
        unit: basket.unit,
      },
    ]);
    const futureVersion = composition('v2', '2026-03-01', [
      {
        costItemId: basket.costItemId,
        costItemNameSnapshot: basket.name,
        quantity: 2,
        unit: basket.unit,
      },
    ]);
    const input = {
      compositionVersions: [oldVersion, futureVersion],
      costEntriesByItemId: new Map([
        [
          basket.costItemId,
          [costEntry('old-cost', '2026-01-01', 5), costEntry('future-cost', '2026-03-01', 7)],
        ],
      ]),
      costItems: [basket],
      product: { costMode: 'composition' as const, productId: 'product-1' },
    };

    const oldResult = resolveRetailProductCost({ ...input, referenceDate: '2026-02-01' });
    const futureResult = resolveRetailProductCost({ ...input, referenceDate: '2026-04-01' });

    expect(oldResult).toMatchObject({ compositionVersionId: 'v1', cost: 5, status: 'available' });
    expect(futureResult).toMatchObject({
      compositionVersionId: 'v2',
      cost: 14,
      status: 'available',
    });
  });

  it('returns an explicit incomplete state for a component without historical cost', () => {
    const basket = costItem('basket', 'Cesta');
    const chocolate = costItem('chocolate', 'Chocolate');
    const result = resolveRetailProductCost({
      compositionVersions: [
        composition('v1', '2026-01-01', [
          {
            costItemId: basket.costItemId,
            costItemNameSnapshot: basket.name,
            quantity: 1,
            unit: basket.unit,
          },
          {
            costItemId: chocolate.costItemId,
            costItemNameSnapshot: chocolate.name,
            quantity: 1,
            unit: chocolate.unit,
          },
        ]),
      ],
      costEntriesByItemId: new Map([
        [basket.costItemId, [costEntry('basket-entry', '2026-01-01', 5)]],
      ]),
      costItems: [basket, chocolate],
      product: { costMode: 'composition', productId: 'product-1' },
      referenceDate: '2026-01-15',
    });

    expect(result).toMatchObject({
      missingCostItemIds: ['chocolate'],
      reason: 'missing_component_cost',
      status: 'incomplete',
    });
  });
});
