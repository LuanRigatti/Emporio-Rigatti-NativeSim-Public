import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, useEffect } from 'react';

const mockCategoryLoad = jest.fn<Promise<void>, [string, number]>().mockResolvedValue(undefined);
const mockCostItemLoad = jest.fn<Promise<void>, [string, number]>().mockResolvedValue(undefined);
const mockProductLoad = jest.fn<Promise<void>, [string, number]>().mockResolvedValue(undefined);
const mockCompositionLoad = jest
  .fn<Promise<void>, [string, string, number]>()
  .mockResolvedValue(undefined);
const mockCostEntryLoad = jest
  .fn<Promise<void>, [string, string, number]>()
  .mockResolvedValue(undefined);

let mockSessionVersion = 1;
let observedCatalog: ReturnType<
  typeof import('@/hooks/useRetailOrderCatalog').useRetailOrderCatalog
>;

const mockProducts = [
  {
    active: true,
    categoryId: 'category-1',
    costMode: 'direct' as const,
    directCostItemId: 'cost-direct',
    productId: 'product-direct',
    productName: 'Produto direto',
    standardSalePrice: 10,
  },
  {
    active: true,
    categoryId: 'category-1',
    costMode: 'composition' as const,
    productId: 'product-composition',
    productName: 'Produto composição',
    standardSalePrice: 20,
  },
];

const mockComposition = {
  active: true,
  components: [
    { costItemId: 'cost-component', costItemNameSnapshot: 'Componente', quantity: 2, unit: 'un' },
  ],
  compositionVersionId: 'composition-1',
  effectiveFrom: '2026-09-15',
  productId: 'product-composition',
};

jest.mock('@/providers', () => ({
  useAuth: () => ({ sessionVersion: mockSessionVersion, user: { id: 'user-1' } }),
}));

jest.mock('@/hooks/useRetailCategories', () => ({
  useRetailCategories: () => ({ categories: [], error: undefined, loading: false }),
}));
jest.mock('@/hooks/useRetailClients', () => ({
  useRetailClients: () => ({ clients: [], error: undefined, loading: false }),
}));
jest.mock('@/hooks/useRetailCostItems', () => ({
  useRetailCostItems: () => ({ items: [], error: undefined, loading: false }),
}));
jest.mock('@/hooks/useRetailProducts', () => ({
  useRetailProducts: () => ({ products: [], error: undefined, loading: false }),
}));

jest.mock('@/services/retail-catalog', () => ({
  retailCategoryDataSource: {
    getSnapshot: () => [],
    list: () => [{ active: true, categoryId: 'category-1', label: 'Cestas' }],
    load: mockCategoryLoad,
  },
  retailProductDataSource: {
    getSnapshot: () => mockProducts,
    list: () => mockProducts,
    load: mockProductLoad,
  },
}));

jest.mock('@/services/retail-costs', () => ({
  retailCompositionDataSource: {
    getSnapshot: (productId: string) =>
      productId === 'product-composition' ? [mockComposition] : null,
    list: (productId: string) => (productId === 'product-composition' ? [mockComposition] : []),
    load: mockCompositionLoad,
    subscribe: () => () => undefined,
  },
  retailCostEntryDataSource: {
    getSnapshot: () => [],
    list: (costItemId: string) => [
      {
        effectiveDate: '2026-09-15',
        entryId: `${costItemId}-entry`,
        normalizedUnitCost: 5,
        purchasedQuantity: 1,
        purchaseTotalCost: 5,
        unit: 'un',
      },
    ],
    load: mockCostEntryLoad,
    subscribe: () => () => undefined,
  },
  retailCostItemDataSource: {
    getSnapshot: () => [],
    list: () => [
      { active: true, costItemId: 'cost-direct', name: 'Direto', unit: 'un' },
      { active: true, costItemId: 'cost-component', name: 'Componente', unit: 'un' },
    ],
    load: mockCostItemLoad,
  },
}));

// This module has to be loaded after the datasource mocks are registered.
const { useRetailOrderCatalog } =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@/hooks/useRetailOrderCatalog') as typeof import('@/hooks/useRetailOrderCatalog');

function Probe() {
  const catalog = useRetailOrderCatalog();
  useEffect(() => {
    observedCatalog = catalog;
  }, [catalog]);
  return null;
}

describe('useRetailOrderCatalog preparation', () => {
  beforeEach(() => {
    mockSessionVersion = 1;
    mockCategoryLoad.mockClear();
    mockCompositionLoad.mockClear();
    mockCostEntryLoad.mockClear();
    mockCostItemLoad.mockClear();
    mockProductLoad.mockClear();
  });

  function renderProbe(): ReactTestRenderer {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(Probe));
    });
    return renderer;
  }

  it('resolves warm direct and composition contexts locally and reuses a date-scoped context', async () => {
    renderProbe();

    let directContext: Awaited<ReturnType<typeof observedCatalog.prepareForOrder>>;
    let repeatedDirectContext: Awaited<ReturnType<typeof observedCatalog.prepareForOrder>>;
    let compositionContext: Awaited<ReturnType<typeof observedCatalog.prepareForOrder>>;
    await act(async () => {
      directContext = await observedCatalog.prepareForOrder(['product-direct'], {
        referenceDate: '2026-09-16',
        refresh: false,
      });
      repeatedDirectContext = await observedCatalog.prepareForOrder(['product-direct'], {
        referenceDate: '2026-09-16',
        refresh: false,
      });
      compositionContext = await observedCatalog.prepareForOrder(['product-composition'], {
        referenceDate: '2026-09-16',
        refresh: false,
      });
    });

    expect(repeatedDirectContext!).toBe(directContext!);
    expect(compositionContext!.compositionVersionsByProductId?.get('product-composition')).toEqual([
      mockComposition,
    ]);
    expect(compositionContext!.costEntriesByItemId.get('cost-component')).toHaveLength(1);
    expect(mockCategoryLoad).not.toHaveBeenCalled();
    expect(mockCostItemLoad).not.toHaveBeenCalled();
    expect(mockProductLoad).not.toHaveBeenCalled();
    expect(mockCompositionLoad).not.toHaveBeenCalled();
    expect(mockCostEntryLoad).not.toHaveBeenCalled();
  });

  it('does not reuse a prepared context for another reference date or session, and refreshes on demand', async () => {
    const renderer = renderProbe();
    let initialContext: Awaited<ReturnType<typeof observedCatalog.prepareForOrder>>;
    let changedDateContext: Awaited<ReturnType<typeof observedCatalog.prepareForOrder>>;
    await act(async () => {
      initialContext = await observedCatalog.prepareForOrder(['product-direct'], {
        referenceDate: '2026-09-16',
        refresh: false,
      });
      changedDateContext = await observedCatalog.prepareForOrder(['product-direct'], {
        referenceDate: '2026-09-17',
        refresh: false,
      });
    });
    expect(changedDateContext!).not.toBe(initialContext!);

    mockSessionVersion = 2;
    act(() => {
      renderer.update(createElement(Probe));
    });
    let changedSessionContext: Awaited<ReturnType<typeof observedCatalog.prepareForOrder>>;
    await act(async () => {
      changedSessionContext = await observedCatalog.prepareForOrder(['product-direct'], {
        referenceDate: '2026-09-17',
        refresh: false,
      });
      await observedCatalog.prepareForOrder(['product-direct'], {
        referenceDate: '2026-09-17',
        refresh: true,
      });
    });

    expect(changedSessionContext!).not.toBe(changedDateContext!);
    expect(mockCategoryLoad).toHaveBeenCalledTimes(1);
    expect(mockCostItemLoad).toHaveBeenCalledTimes(1);
    expect(mockProductLoad).toHaveBeenCalledTimes(1);
    expect(mockCostEntryLoad).toHaveBeenCalledWith('cost-direct', 'user-1', 2);
  });
});
