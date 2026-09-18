import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import {
  useRetailProductCurrentCost,
  type RetailProductCurrentCostOptions,
} from '@/hooks/useRetailProductCurrentCost';
import type {
  RetailCompositionVersion,
  RetailCostEntry,
  RetailCostItem,
  RetailProduct,
} from '@/types/data';

const mockLoad = jest.fn<Promise<void>, [string, string, number]>();
const mockSnapshots = new Map<string, readonly RetailCostEntry[] | null>();
const mockResolvers = new Map<string, () => void>();
let mockCompositionState: {
  error?: string;
  loading: boolean;
  snapshot: readonly RetailCompositionVersion[] | null;
  versions: readonly RetailCompositionVersion[];
};
let mockAuth = {
  sessionVersion: 1,
  user: { id: 'uid-retail' },
};

jest.mock('@/providers', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@/hooks/useRetailCompositions', () => ({
  useRetailCompositions: () => mockCompositionState,
}));

jest.mock('@/services/retail-costs', () => {
  const { resolveRetailProductCost } = jest.requireActual(
    '@/services/retail-costs/RetailProductCostResolver',
  ) as typeof import('@/services/retail-costs/RetailProductCostResolver');
  return {
    resolveRetailProductCost,
    retailCostEntryDataSource: {
      getSnapshot: (costItemId: string) => mockSnapshots.get(costItemId) ?? null,
      list: (costItemId: string) => mockSnapshots.get(costItemId) ?? [],
      load: (costItemId: string, userId: string, sessionVersion: number) =>
        mockLoad(costItemId, userId, sessionVersion),
      subscribe: () => () => undefined,
    },
  };
});

jest.mock('@/utils/data', () => {
  const actual = jest.requireActual('@/utils/data') as typeof import('@/utils/data');
  return { ...actual, todayIso: () => '2026-09-18' };
});

function Harness({
  costItems,
  onRender,
  options,
  product,
}: {
  costItems: readonly RetailCostItem[];
  onRender: (state: ReturnType<typeof useRetailProductCurrentCost>) => void;
  options?: RetailProductCurrentCostOptions;
  product: RetailProduct | null;
}) {
  onRender(useRetailProductCurrentCost(product, costItems, options));
  return null;
}

function product(
  overrides: Partial<RetailProduct> & Pick<RetailProduct, 'costMode'>,
): RetailProduct {
  return {
    active: true,
    categoryId: 'category-1',
    costMode: overrides.costMode,
    createdAt: undefined as never,
    productId: 'product-1',
    productName: 'Cesta Teste',
    standardSalePrice: 179.9,
    updatedAt: undefined as never,
    ...overrides,
  };
}

function costItem(costItemId: string, name: string): RetailCostItem {
  return {
    active: true,
    costItemId,
    createdAt: undefined as never,
    name,
    normalizedName: name.toLowerCase(),
    unit: 'unidade',
    updatedAt: undefined as never,
  };
}

function entry(
  entryId: string,
  effectiveDate: string,
  normalizedUnitCost: number,
): RetailCostEntry {
  return {
    createdAt: undefined as never,
    effectiveDate,
    entryId,
    normalizedUnitCost,
    purchaseTotalCost: normalizedUnitCost,
    purchasedQuantity: 1,
    unit: 'unidade',
  };
}

function compositionVersion(): RetailCompositionVersion {
  return {
    active: true,
    components: [
      {
        costItemId: 'croassaint',
        costItemNameSnapshot: 'Croassaint',
        quantity: 1,
        unit: 'unidade',
      },
      {
        costItemId: 'drip',
        costItemNameSnapshot: 'Drip de Café Orfeu',
        quantity: 1,
        unit: 'unidade',
      },
    ],
    compositionVersionId: 'composition-1',
    createdAt: undefined as never,
    effectiveFrom: '2026-09-16',
    productId: 'product-1',
  };
}

describe('useRetailProductCurrentCost', () => {
  let renderer: ReactTestRenderer | undefined;
  let state: ReturnType<typeof useRetailProductCurrentCost> | undefined;

  beforeEach(() => {
    mockAuth = { sessionVersion: 1, user: { id: 'uid-retail' } };
    mockCompositionState = { loading: false, snapshot: [], versions: [] };
    mockLoad.mockReset().mockImplementation(
      (costItemId: string) =>
        new Promise<void>((resolve) => {
          mockResolvers.set(costItemId, resolve);
        }),
    );
    mockSnapshots.clear();
    mockResolvers.clear();
    renderer = undefined;
    state = undefined;
  });

  afterEach(() => {
    if (renderer) act(() => renderer?.unmount());
  });

  it('keeps a saved direct product loading while an empty cached snapshot is still being hydrated', async () => {
    const croassaint = costItem('croassaint', 'Croassaint');
    mockSnapshots.set('croassaint', []);

    await act(async () => {
      renderer = create(
        createElement(Harness, {
          costItems: [croassaint],
          onRender: (next) => (state = next),
          product: product({ costMode: 'direct', directCostItemId: 'croassaint' }),
        }),
      );
      await Promise.resolve();
    });

    expect(state).toEqual(
      expect.objectContaining({ mode: 'direct', referenceDate: '2026-09-18', status: 'loading' }),
    );
    expect(state?.status).not.toBe('unavailable');

    mockSnapshots.set('croassaint', [
      entry('cost-20260916', '2026-09-16', 1),
      entry('cost-future', '2026-09-19', 99),
    ]);
    await act(async () => {
      mockResolvers.get('croassaint')?.();
      await Promise.resolve();
    });

    expect(state).toEqual(
      expect.objectContaining({ cost: 1, referenceDate: '2026-09-18', status: 'available' }),
    );
  });

  it('keeps a saved product loading while the cost-item catalog is hydrating', async () => {
    await act(async () => {
      renderer = create(
        createElement(Harness, {
          costItems: [],
          onRender: (next) => (state = next),
          options: { costItemsLoading: true },
          product: product({ costMode: 'direct', directCostItemId: 'croassaint' }),
        }),
      );
    });

    expect(state?.status).toBe('loading');
    expect(state?.message).toBeUndefined();
  });

  it('resolves a saved composition from the latest historical entries valid on the reference date', async () => {
    const croassaint = costItem('croassaint', 'Croassaint');
    const drip = costItem('drip', 'Drip de Café Orfeu');
    const version = compositionVersion();
    mockCompositionState = { loading: false, snapshot: [version], versions: [version] };
    mockSnapshots.set('croassaint', []);
    mockSnapshots.set('drip', []);

    await act(async () => {
      renderer = create(
        createElement(Harness, {
          costItems: [croassaint, drip],
          onRender: (next) => (state = next),
          product: product({ costMode: 'composition', compositionVersionId: 'composition-1' }),
        }),
      );
      await Promise.resolve();
    });

    expect(state?.status).toBe('loading');

    mockSnapshots.set('croassaint', [entry('croassaint-20260916', '2026-09-16', 1)]);
    mockSnapshots.set('drip', [entry('drip-20260916', '2026-09-16', 4.9)]);
    await act(async () => {
      mockResolvers.get('croassaint')?.();
      mockResolvers.get('drip')?.();
      await Promise.resolve();
    });

    expect(state).toEqual(
      expect.objectContaining({ cost: 5.9, referenceDate: '2026-09-18', status: 'available' }),
    );
  });

  it('keeps a new unsaved product without a resolved cost', async () => {
    await act(async () => {
      renderer = create(
        createElement(Harness, {
          costItems: [],
          onRender: (next) => (state = next),
          product: null,
        }),
      );
    });

    expect(state).toEqual(
      expect.objectContaining({
        message: 'Salve o produto para resolver o custo atual.',
        status: 'unavailable',
      }),
    );
    expect(mockLoad).not.toHaveBeenCalled();
  });
});
