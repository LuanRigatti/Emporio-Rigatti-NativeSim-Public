/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';

import RetailCategoryProductsRoute from '@/app/catalogo-varejo/[categoryId]';

const mockUpdate = jest.fn<Promise<void>, [string, unknown]>().mockResolvedValue(undefined);
const mockPush = jest.fn();
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
    useRouter: () => ({ push: mockPush }),
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
    mockPush.mockClear();
    mockCreateVersion.mockClear().mockResolvedValue('new-version');
    mockCostItems = [];
    mockCurrentProduct = { ...baseProduct };
    mockCompositionVersions = [];
  });

  it('shows the missing-cost state and opens the product edit route', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailCategoryProductsRoute));
    });

    expect(findNodes(renderer, 'text-button')[0]?.props).toEqual(
      expect.objectContaining({ label: 'Configurar custo' }),
    );
    expect(collectText(renderer.root)).toContain('Custo não configurado');

    act(() => findNodes(renderer, 'text-button')[0]?.props.onPress());

    expect(mockPush).toHaveBeenCalledWith({
      params: { productId: 'product-1' },
      pathname: '/catalogo-varejo/produto/[productId]',
    });
  });

  it('uses the same visible action to reopen an existing direct-cost configuration route', () => {
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

    expect(mockPush).toHaveBeenCalledWith({
      params: { productId: 'product-1' },
      pathname: '/catalogo-varejo/produto/[productId]',
    });
  });

  it('pushes the product route from the product row', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailCategoryProductsRoute));
    });
    act(() => findNodes(renderer, 'list-item')[0]?.props.onPress());

    expect(mockPush).toHaveBeenCalledWith({
      params: { productId: 'product-1' },
      pathname: '/catalogo-varejo/produto/[productId]',
    });
  });

  it('routes cost and composition context actions to the same product page', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailCategoryProductsRoute));
    });

    const actions = findNodes(renderer, 'context-menu')[0]?.props.actions as {
      onPress: () => void;
    }[];
    act(() => actions[0]?.onPress());
    act(() => actions[1]?.onPress());

    expect(mockPush).toHaveBeenNthCalledWith(1, {
      params: { productId: 'product-1' },
      pathname: '/catalogo-varejo/produto/[productId]',
    });
    expect(mockPush).toHaveBeenNthCalledWith(2, {
      params: { productId: 'product-1' },
      pathname: '/catalogo-varejo/produto/[productId]',
    });
  });

  it('pushes the new product page with the current category', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailCategoryProductsRoute));
    });

    act(() => findNodes(renderer, 'toolbar-button')[0]?.props.onPress());

    expect(mockPush).toHaveBeenCalledWith({
      params: { categoryId: 'category-1' },
      pathname: '/catalogo-varejo/produto/novo',
    });
  });
});
