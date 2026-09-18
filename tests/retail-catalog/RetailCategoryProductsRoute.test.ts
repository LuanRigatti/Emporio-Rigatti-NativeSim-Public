/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';

import RetailCategoryProductsRoute from '@/app/catalogo-varejo/[categoryId]';

const mockUpdate = jest.fn<Promise<void>, [string, unknown]>().mockResolvedValue(undefined);
const mockCreateVersion = jest
  .fn<Promise<string>, [unknown, unknown]>()
  .mockResolvedValue('new-version');
let mockCostItems: { active: boolean; costItemId: string; name: string; unit: string }[] = [];
const baseProduct: {
  active: boolean;
  categoryId: string;
  compositionVersionId?: string;
  costMode?: 'composition' | 'direct';
  directCostItemId?: string;
  productId: string;
  productName: string;
  standardSalePrice: number;
} = {
  active: true,
  categoryId: 'category-1',
  productId: 'product-1',
  productName: 'Cesta Teste',
  standardSalePrice: 100,
};
let mockCurrentProduct = { ...baseProduct };
let mockCompositionVersions: unknown[] = [];

jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  const Toolbar = Object.assign(
    function Toolbar({ children }: { children?: ReactNode }) {
      return React.createElement('toolbar', null, children);
    },
    {
      Button: function ToolbarButton(props: Record<string, unknown>) {
        return React.createElement('toolbar-button', props);
      },
    },
  );
  return {
    Stack: { Toolbar },
    useLocalSearchParams: () => ({ categoryId: 'category-1' }),
  };
});

jest.mock('@/components/buttons', () => ({
  TextButton: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('text-button', props, props.label as ReactNode);
  },
}));

jest.mock('@/components/lists', () => ({
  ListItem: ({ children, ...props }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('list-item', props, children);
  },
}));

jest.mock('@/components/layout', () => ({
  NativeGlassHeader: () => null,
}));

jest.mock('@/components/native', () => ({
  NativeCardContextMenu: ({ children, ...props }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('context-menu', props, children);
  },
  NativeRetailCompositionSheet: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('composition-sheet', props);
  },
  NativeRetailProductCostSheet: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('product-cost-sheet', props);
  },
  NativeRetailProductFormSheet: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('product-form-sheet', props);
  },
}));

jest.mock('@/components/overlays', () => ({
  ConfirmationDialog: () => null,
}));

jest.mock('@/components/premium', () => ({
  EmptyState: ({ children, ...props }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('empty-state', props, children);
  },
  ErrorState: () => null,
  Loading: () => null,
  PremiumCard: ({ children, ...props }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('premium-card', props, children);
  },
  PremiumScreen: ({ children, ...props }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('premium-screen', props, children);
  },
}));

jest.mock('@/features/settings/components/SettingsIcon', () => () => null);

jest.mock('@/hooks/useRetailCategories', () => ({
  useRetailCategories: () => ({
    categories: [{ active: true, categoryId: 'category-1', label: 'Cestas' }],
    error: undefined,
    loading: false,
    reload: jest.fn(),
  }),
}));

jest.mock('@/hooks/useRetailCompositions', () => ({
  useRetailCompositions: () => ({
    createVersion: mockCreateVersion,
    versions: mockCompositionVersions,
  }),
}));

jest.mock('@/hooks/useRetailCostItems', () => ({
  useRetailCostItems: () => ({ items: mockCostItems }),
}));

jest.mock('@/hooks/useRetailProductCurrentCost', () => ({
  useRetailProductCurrentCost: () => ({
    cost: 12.9,
    mode: 'composition',
    referenceDate: '2026-09-16',
    status: 'available',
  }),
}));

jest.mock('@/hooks/useRetailProducts', () => ({
  useRetailProducts: () => ({
    create: jest.fn(),
    error: undefined,
    loading: false,
    products: [mockCurrentProduct],
    reload: jest.fn(),
    remove: jest.fn(),
    update: mockUpdate,
  }),
}));

jest.mock('@/providers', () => ({
  useAppMode: () => ({ mode: 'retail' }),
}));

jest.mock('@/services/retail-costs', () => ({
  normalizeRetailQuantity: (value: string) => Number(value),
}));

jest.mock('@/theme', () => ({
  getCardSurfaceColor: () => '#FFFFFF',
  useAppTheme: () => ({
    resolvedMode: 'light',
    theme: {
      colors: {
        background: '#FFFFFF',
        danger: '#FF0000',
        separator: '#DDDDDD',
        surface: '#FFFFFF',
        textPrimary: '#000000',
        textSecondary: '#666666',
      },
      radius: { sm: 8, xl: 20 },
      sizes: { iconMedium: 20, touchTargetMinimum: 44 },
      spacing: { md: 16, sm: 8, xl: 24 },
      typography: { body: {}, footnote: {}, title3: {} },
    },
  }),
}));

jest.mock('@/utils/data', () => ({
  formatCurrency: (value: number) => `R$ ${value}`,
  normalizeMoney: (value: string) => Number(value),
  todayIso: () => '2026-09-16',
}));

jest.mock('@/utils/presentation/testModeValues', () => ({
  useTestModePresentation: () => ({ enabled: false }),
}));

function findNodes(renderer: ReactTestRenderer, type: string): ReactTestInstance[] {
  return renderer.root.findAll((node) => String(node.type) === type);
}

function collectText(node: ReactTestInstance): string {
  return node.children
    .map((child) => (typeof child === 'string' ? child : collectText(child)))
    .join('');
}

describe('retail category products cost configuration affordance', () => {
  beforeEach(() => {
    mockUpdate.mockClear();
    mockCreateVersion.mockClear().mockResolvedValue('new-version');
    mockCostItems = [];
    mockCurrentProduct = { ...baseProduct };
    mockCompositionVersions = [];
  });

  it('shows the missing-cost state and opens the existing configuration sheet', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailCategoryProductsRoute));
    });

    expect(findNodes(renderer, 'text-button')[0]?.props).toEqual(
      expect.objectContaining({ label: 'Configurar custo' }),
    );
    expect(collectText(renderer.root)).toContain('Custo não configurado');

    act(() => findNodes(renderer, 'text-button')[0]?.props.onPress());

    expect(findNodes(renderer, 'product-cost-sheet')[0]?.props).toEqual(
      expect.objectContaining({
        initialValues: { costMode: '', directCostItemId: '' },
        visible: true,
      }),
    );
  });

  it('uses the same visible action to reopen an existing direct-cost configuration', () => {
    mockCurrentProduct = {
      ...baseProduct,
      costMode: 'direct',
      directCostItemId: 'cost-1',
    };

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailCategoryProductsRoute));
    });

    expect(findNodes(renderer, 'text-button')[0]?.props).toEqual(
      expect.objectContaining({ label: 'Editar custo' }),
    );
    act(() => findNodes(renderer, 'text-button')[0]?.props.onPress());

    expect(findNodes(renderer, 'product-cost-sheet')[0]?.props.initialValues).toEqual({
      costMode: 'direct',
      directCostItemId: 'cost-1',
    });
  });

  it('persists the selected cost mode when editing a product', async () => {
    mockCostItems = [{ active: true, costItemId: 'cost-1', name: 'Café', unit: 'un' }];

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailCategoryProductsRoute));
    });
    act(() => findNodes(renderer, 'list-item')[0]?.props.onPress());

    const form = findNodes(renderer, 'product-form-sheet')[0];
    expect(form.props.currentCost).toEqual(
      expect.objectContaining({ cost: 12.9, status: 'available' }),
    );
    await act(async () => {
      await form.props.onSubmit({
        categoryId: 'category-1',
        costMode: 'direct',
        directCostItemId: 'cost-1',
        flavor: '',
        packageSize: '',
        productName: 'Cesta Teste',
        skuCode: '',
        standardSalePrice: '100',
        variant: '',
      });
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      'product-1',
      expect.objectContaining({
        compositionVersionId: null,
        costMode: 'direct',
        directCostItemId: 'cost-1',
      }),
    );
  });

  it('persists a composition from exactly the selected component IDs', async () => {
    mockCostItems = [
      { active: true, costItemId: 'valid-croassaint', name: 'Croassaint', unit: 'un' },
      { active: true, costItemId: 'drip', name: 'Drip', unit: 'un' },
      { active: true, costItemId: 'stale-croassaint', name: 'Croassaint', unit: 'un' },
    ];
    mockCurrentProduct = {
      ...baseProduct,
      compositionVersionId: 'old-version',
      costMode: 'composition',
    };
    mockCompositionVersions = [
      {
        active: true,
        components: [
          {
            costItemId: 'valid-croassaint',
            costItemNameSnapshot: 'Croassaint',
            quantity: 1,
            unit: 'un',
          },
          {
            costItemId: 'stale-croassaint',
            costItemNameSnapshot: 'Croassaint',
            quantity: 1,
            unit: 'un',
          },
        ],
        compositionVersionId: 'old-version',
        effectiveFrom: '2026-09-16',
        productId: 'product-1',
      },
    ];

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailCategoryProductsRoute));
    });
    act(() => findNodes(renderer, 'list-item')[0]?.props.onPress());
    act(() => findNodes(renderer, 'product-form-sheet')[0]?.props.onOpenComposition());

    const compositionSheet = findNodes(renderer, 'composition-sheet')[0];
    expect(compositionSheet?.props.initialValues.components).toEqual([
      { costItemId: 'valid-croassaint', key: 'existing-component-0', quantity: '1' },
      { costItemId: 'stale-croassaint', key: 'existing-component-1', quantity: '1' },
    ]);

    await act(async () => {
      await compositionSheet?.props.onSubmit({
        components: [
          { costItemId: 'valid-croassaint', key: 'existing-component-0', quantity: '1' },
          { costItemId: 'drip', key: 'new-component', quantity: '2' },
        ],
        effectiveFrom: '2026-09-18',
      });
    });

    expect(mockCreateVersion).toHaveBeenCalledWith(
      {
        components: [
          {
            costItemId: 'valid-croassaint',
            costItemNameSnapshot: 'Croassaint',
            quantity: 1,
            unit: 'un',
          },
          { costItemId: 'drip', costItemNameSnapshot: 'Drip', quantity: 2, unit: 'un' },
        ],
        effectiveFrom: '2026-09-18',
      },
      expect.any(Map),
    );
    expect(mockUpdate).toHaveBeenCalledWith('product-1', {
      compositionVersionId: 'new-version',
      costMode: 'composition',
      directCostItemId: null,
    });
  });
});
