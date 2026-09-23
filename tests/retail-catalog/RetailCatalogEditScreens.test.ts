/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { RetailCompositionEditScreen } from '@/features/retail-catalog/components/RetailCompositionEditScreen';
import { RetailProductEditScreen } from '@/features/retail-catalog/components/RetailProductEditScreen';

const mockCreateElement = require('react').createElement as typeof import('react').createElement;
const productEditSource = readFileSync(
  resolve(process.cwd(), 'src/features/retail-catalog/components/RetailProductEditScreen.tsx'),
  'utf8',
);
const compositionEditSource = readFileSync(
  resolve(process.cwd(), 'src/features/retail-catalog/components/RetailCompositionEditScreen.tsx'),
  'utf8',
);
const labeledFieldSource = readFileSync(
  resolve(
    process.cwd(),
    'src/features/retail-catalog/components/RetailCatalogLabeledTextField.tsx',
  ),
  'utf8',
);

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockCreate = jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined);
const mockUpdate = jest.fn<Promise<void>, [string, unknown]>().mockResolvedValue(undefined);
const mockCreateVersion = jest
  .fn<Promise<string>, [unknown, unknown]>()
  .mockResolvedValue('new-version');

const mockProduct = {
  active: true,
  categoryId: 'category-1',
  compositionVersionId: 'composition-1',
  costMode: 'composition' as const,
  createdAt: null,
  directCostItemId: undefined,
  productId: 'product-1',
  productName: 'Cesta Teste',
  standardSalePrice: 100,
  updatedAt: null,
};

const mockComposition = {
  active: true,
  components: [{ costItemId: 'cost-1', costItemNameSnapshot: 'Café', quantity: 2, unit: 'kg' }],
  compositionVersionId: 'composition-1',
  createdAt: null,
  effectiveFrom: '2026-09-16',
  productId: 'product-1',
};

let mockCompositionVersions = [mockComposition];

jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  useNavigation: () => ({ dispatch: jest.fn() }),
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: jest.fn(),
}));

jest.mock('@/components/feedback', () => ({
  InlineError: ({ message }: { message: string }) => mockCreateElement('inline-error', { message }),
}));

jest.mock('@/components/layout', () => ({ NativeGlassHeader: () => null }));

jest.mock('@/components/native', () => ({
  NativeButton: (props: Record<string, unknown>) => mockCreateElement('native-button', props),
  NativeDatePicker: (props: Record<string, unknown>) =>
    mockCreateElement('native-date-picker', props),
  NativeDropdown: (props: Record<string, unknown>) => mockCreateElement('native-dropdown', props),
  NativeTextField: (props: Record<string, unknown>) =>
    mockCreateElement('native-text-field', props),
}));

jest.mock('@/components/overlays', () => ({ ConfirmationDialog: () => null }));

jest.mock('@/components/ui/progressive-blur', () => ({
  ProgressiveBlur: (props: Record<string, unknown>) => mockCreateElement('progressive-blur', props),
}));

jest.mock('@/config/featureFlags', () => ({ ENABLE_PROGRESSIVE_BLUR: true }));

jest.mock('@/components/premium', () => ({
  EmptyState: ({ children, ...props }: { children?: ReactNode }) =>
    mockCreateElement('empty-state', props, children),
  ErrorState: ({ children, ...props }: { children?: ReactNode }) =>
    mockCreateElement('error-state', props, children),
  Loading: ({ children, ...props }: { children?: ReactNode }) =>
    mockCreateElement('loading', props, children),
  PremiumCard: ({ children, ...props }: { children?: ReactNode }) =>
    mockCreateElement('premium-card', props, children),
  PremiumScreen: ({ children, ...props }: { children?: ReactNode }) =>
    mockCreateElement('premium-screen', props, children),
  PremiumSection: ({ children, ...props }: { children?: ReactNode }) =>
    mockCreateElement('premium-section', props, children),
}));

jest.mock('@/hooks/useRetailCategories', () => ({
  useRetailCategories: () => ({
    categories: [
      { active: true, categoryId: 'category-1', label: 'Cestas' },
      { active: true, categoryId: 'category-2', label: 'Baldes' },
    ],
    error: undefined,
    loading: false,
  }),
}));

jest.mock('@/hooks/useRetailCostItems', () => ({
  useRetailCostItems: () => ({
    error: undefined,
    items: [
      { active: true, costItemId: 'cost-1', name: 'Café', unit: 'kg' },
      { active: true, costItemId: 'cost-2', name: 'Farinha', unit: 'kg' },
    ],
    loading: false,
  }),
}));

jest.mock('@/hooks/useRetailProductCurrentCost', () => ({
  useRetailProductCurrentCost: () => ({
    cost: 12.5,
    mode: 'composition',
    referenceDate: '2026-09-16',
    status: 'available',
  }),
}));

jest.mock('@/hooks/useRetailProducts', () => ({
  useRetailProducts: () => ({
    create: mockCreate,
    error: undefined,
    loading: false,
    products: [mockProduct],
    update: mockUpdate,
  }),
}));

jest.mock('@/hooks/useRetailCompositions', () => ({
  useRetailCompositions: () => ({
    createVersion: mockCreateVersion,
    error: undefined,
    loading: false,
    versions: mockCompositionVersions,
  }),
}));

jest.mock('@/providers', () => ({
  useAppMode: () => ({ mode: 'retail' }),
  useAppSafeAreaInsets: () => ({ bottom: 34 }),
}));

jest.mock('@/services/retail-costs', () => ({
  getRetailCompositionComponentIdIssues: (components: readonly { costItemId: string }[]) => {
    const counts = new Map<string, number>();
    const emptyIndexes: number[] = [];
    components.forEach((component, index) => {
      const costItemId = component.costItemId.trim();
      if (!costItemId) {
        emptyIndexes.push(index);
        return;
      }
      counts.set(costItemId, (counts.get(costItemId) ?? 0) + 1);
    });
    return {
      duplicateIds: Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([costItemId]) => costItemId),
      emptyIndexes,
    };
  },
  normalizeRetailQuantity: (value: string) => Number(value),
}));

jest.mock('@/theme', () => ({
  useAppTheme: () => ({
    resolvedMode: 'light',
    theme: {
      colors: {
        background: '#fff',
        contrastContent: '#fff',
        contrastSurface: '#000',
        danger: '#f00',
        separator: '#ddd',
        textPrimary: '#000',
        textSecondary: '#666',
      },
      radius: { card: 20, xl: 22 },
      layout: { tabBarHeight: 80 },
      sizes: { touchTargetMinimum: 44 },
      spacing: { md: 16, sm: 8, xl: 20, xxs: 4 },
      typography: { body: {}, footnote: {}, title3: {} },
    },
  }),
}));

jest.mock('@/utils/data', () => ({
  formatCurrency: (value: number) => `R$ ${value}`,
  formatPtBrDate: (value: string) => value,
  normalizeMoney: (value: string) => Number(value),
  parseIsoCalendarDate: () => new Date('2026-09-16T00:00:00.000Z'),
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

describe('retail catalog native-stack edit pages', () => {
  beforeEach(() => {
    mockCompositionVersions = [mockComposition];
    mockPush.mockClear();
    mockBack.mockClear();
    mockCreate.mockClear().mockResolvedValue(undefined);
    mockUpdate.mockClear().mockResolvedValue(undefined);
    mockCreateVersion.mockClear().mockResolvedValue('new-version');
  });

  it('keeps catalog field cards and labeled fields constrained to full width', () => {
    expect(productEditSource).toContain("card: { gap: 14, width: '100%' }");
    expect(compositionEditSource).toContain("card: { gap: 14, width: '100%' }");
    expect(labeledFieldSource).toContain("field: { width: '100%' }");
    expect(productEditSource).not.toContain('retailCatalogDiagnostics');
    expect(compositionEditSource).not.toContain('retailCatalogDiagnostics');
    expect(labeledFieldSource).not.toContain('retailCatalogDiagnostics');
  });

  it('uses the large-card radius for every product editor section', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailProductEditScreen, { productId: 'product-1' }));
    });

    const cards = findNodes(renderer, 'premium-card');
    expect(cards).toHaveLength(3);
    expect(cards.every((card) => card.props.style?.[1]?.borderRadius === 38)).toBe(true);
  });

  it('opens composition from the product page without using a sheet', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailProductEditScreen, { productId: 'product-1' }));
    });

    const compositionButton = findNodes(renderer, 'native-button').find(
      (node) => node.props.label === 'Editar composição',
    );
    act(() => compositionButton?.props.onPress());

    expect(mockPush).toHaveBeenCalledWith({
      params: { productId: 'product-1' },
      pathname: '/catalogo-varejo/produto/[productId]/composicao',
    });
    expect(
      findNodes(renderer, 'native-button').some((node) => node.props.label?.includes('Sheet')),
    ).toBe(false);
  });

  it('saves the product through the canonical update mutation', async () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailProductEditScreen, { productId: 'product-1' }));
    });

    const saveButton = findNodes(renderer, 'native-button').find(
      (node) => node.props.label === 'Salvar',
    );
    expect(saveButton?.props).toEqual(
      expect.objectContaining({
        backgroundColor: '#000',
        color: '#fff',
        controlSize: 'large',
        haptic: 'light',
        minHeight: 58,
        variant: 'filled',
      }),
    );
    expect(productEditSource).toContain("alignItems: 'center'");
    expect(productEditSource).toContain('edge="bottom"');
    expect(productEditSource).toContain('pointerEvents="box-none"');
    expect(findNodes(renderer, 'progressive-blur')[0]?.props).toEqual(
      expect.objectContaining({ edge: 'bottom' }),
    );
    expect(findNodes(renderer, 'premium-screen')[0]?.props.contentContainerStyle).toEqual(
      expect.arrayContaining([expect.objectContaining({ paddingBottom: 250 })]),
    );
    await act(async () => {
      await saveButton?.props.onPress();
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      'product-1',
      expect.objectContaining({ costMode: 'composition', productName: 'Cesta Teste' }),
    );
  });

  it('creates a new product with the initial category and returns after adding', async () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(RetailProductEditScreen, {
          initialCategoryId: 'category-1',
          mode: 'create',
        }),
      );
    });

    const categoryField = findNodes(renderer, 'native-dropdown').find(
      (node) => node.props.accessibilityLabel === 'Categoria',
    );
    expect(categoryField?.props.selectedValue).toBe('category-1');
    expect(categoryField?.props.label).toBe('Cestas');
    act(() => categoryField?.props.onValueChange('category-2'));
    expect(
      findNodes(renderer, 'native-dropdown').find(
        (node) => node.props.accessibilityLabel === 'Categoria',
      )?.props.label,
    ).toBe('Baldes');

    const fields = findNodes(renderer, 'native-text-field');
    expect(collectText(renderer.root)).toEqual(
      expect.stringContaining(
        'Nome do produtoVariante/modeloSaborTamanho/embalagemSKUPreço de venda',
      ),
    );
    expect(
      fields.find((field) => field.props.accessibilityLabel === 'Variante ou modelo')?.props
        .placeholder,
    ).toBe('Ex.: Tradicional');
    expect(
      fields.find((field) => field.props.accessibilityLabel === 'Sabor')?.props.placeholder,
    ).toBe('Ex.: Frango');
    expect(
      fields.find((field) => field.props.accessibilityLabel === 'Tamanho da embalagem')?.props
        .placeholder,
    ).toBe('Ex.: 10 unidades');
    expect(
      fields.find((field) => field.props.accessibilityLabel === 'SKU')?.props.placeholder,
    ).toBe('Código comercial');
    expect(
      fields.find((field) => field.props.accessibilityLabel === 'Preço de venda')?.props
        .placeholder,
    ).toBe('R$ 0,00');
    act(() =>
      fields
        .find((field) => field.props.accessibilityLabel === 'Nome do produto')
        ?.props.onChangeText('Balde Teste'),
    );
    act(() =>
      fields
        .find((field) => field.props.accessibilityLabel === 'Preço de venda')
        ?.props.onChangeText('125'),
    );

    const addButton = findNodes(renderer, 'native-button').find(
      (node) => node.props.label === 'Adicionar',
    );
    await act(async () => {
      await addButton?.props.onPress();
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'category-2',
        productName: 'Balde Teste',
        standardSalePrice: 125,
      }),
    );
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
  });

  it('does not expose composition editing before a product exists', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(RetailProductEditScreen, {
          initialCategoryId: 'category-1',
          mode: 'create',
        }),
      );
    });

    act(() =>
      findNodes(renderer, 'native-dropdown')
        .find((node) => node.props.accessibilityLabel === 'Modo de custo')
        ?.props.onValueChange('composition'),
    );

    expect(
      findNodes(renderer, 'native-button').some((node) => node.props.label === 'Editar composição'),
    ).toBe(false);
    expect(
      renderer.root.findAll((node) =>
        node.children.some(
          (child) =>
            typeof child === 'string' && child.includes('Salve o produto para criar a composição.'),
        ),
      ),
    ).not.toHaveLength(0);
  });

  it('preserves direct cost configuration when creating a product', async () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(RetailProductEditScreen, {
          initialCategoryId: 'category-1',
          mode: 'create',
        }),
      );
    });

    act(() =>
      findNodes(renderer, 'native-dropdown')
        .find((node) => node.props.accessibilityLabel === 'Modo de custo')
        ?.props.onValueChange('direct'),
    );
    act(() =>
      findNodes(renderer, 'native-dropdown')
        .find((node) => node.props.accessibilityLabel === 'Item de custo direto')
        ?.props.onValueChange('cost-1'),
    );
    const fields = findNodes(renderer, 'native-text-field');
    act(() =>
      fields
        .find((field) => field.props.accessibilityLabel === 'Nome do produto')
        ?.props.onChangeText('Produto direto'),
    );
    act(() =>
      fields
        .find((field) => field.props.accessibilityLabel === 'Preço de venda')
        ?.props.onChangeText('80'),
    );

    const addButton = findNodes(renderer, 'native-button').find(
      (node) => node.props.label === 'Adicionar',
    );
    await act(async () => {
      await addButton?.props.onPress();
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ costMode: 'direct', directCostItemId: 'cost-1' }),
    );
  });

  it('creates a new composition version and updates the product after saving', async () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailCompositionEditScreen, { productId: 'product-1' }));
    });

    expect(findNodes(renderer, 'native-dropdown')[0]?.props.label).toBe('Café');
    expect(compositionEditSource).not.toContain('variant="plain"');
    expect(collectText(renderer.root)).toContain('Quantidade (kg)');
    expect(collectText(renderer.root)).toContain('Vigente desde');
    expect(findNodes(renderer, 'native-date-picker')[0]?.props.accessibilityLabel).toBe(
      'Vigente desde da composição',
    );

    const saveButton = findNodes(renderer, 'native-button').find(
      (node) => node.props.label === 'Salvar composição',
    );
    await act(async () => {
      await saveButton?.props.onPress();
    });

    expect(mockCreateVersion).toHaveBeenCalledWith(
      {
        components: [
          { costItemId: 'cost-1', costItemNameSnapshot: 'Café', quantity: 2, unit: 'kg' },
        ],
        effectiveFrom: '2026-09-16',
      },
      expect.any(Map),
    );
    expect(mockUpdate).toHaveBeenCalledWith('product-1', {
      compositionVersionId: 'new-version',
      costMode: 'composition',
      directCostItemId: null,
    });
    expect(mockBack).toHaveBeenCalled();
  });

  it('updates the selected component label immediately', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailCompositionEditScreen, { productId: 'product-1' }));
    });

    const itemField = findNodes(renderer, 'native-dropdown')[0];
    expect(itemField.props.label).toBe('Café');
    act(() => itemField.props.onValueChange('cost-2'));

    expect(findNodes(renderer, 'native-dropdown')[0]?.props.label).toBe('Farinha');
  });

  it('does not treat a legacy component without an id as selected', async () => {
    mockCompositionVersions = [
      {
        ...mockComposition,
        components: [{ costItemId: '  ', costItemNameSnapshot: 'Café', quantity: 1, unit: 'kg' }],
      },
    ];

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailCompositionEditScreen, { productId: 'product-1' }));
    });

    expect(findNodes(renderer, 'native-dropdown')[0]?.props.label).toBe('Item');
    expect(findNodes(renderer, 'native-dropdown')[0]?.props.selectedValue).toBe('');

    const saveButton = findNodes(renderer, 'native-button').find(
      (node) => node.props.label === 'Salvar composição',
    );
    await act(async () => {
      await saveButton?.props.onPress();
    });

    expect(findNodes(renderer, 'inline-error')[0]?.props.message).toBe(
      'Selecione um item de custo para cada componente.',
    );
    expect(mockCreateVersion).not.toHaveBeenCalled();
  });

  it('blocks duplicate legacy component ids without removing either row', async () => {
    mockCompositionVersions = [
      {
        ...mockComposition,
        components: [
          { costItemId: 'cost-1', costItemNameSnapshot: 'Café', quantity: 1, unit: 'kg' },
          { costItemId: 'cost-1', costItemNameSnapshot: 'Café', quantity: 2, unit: 'kg' },
        ],
      },
    ];

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailCompositionEditScreen, { productId: 'product-1' }));
    });

    expect(findNodes(renderer, 'native-dropdown')).toHaveLength(2);
    expect(findNodes(renderer, 'native-dropdown').map((node) => node.props.label)).toEqual([
      'Café',
      'Café',
    ]);

    const saveButton = findNodes(renderer, 'native-button').find(
      (node) => node.props.label === 'Salvar composição',
    );
    await act(async () => {
      await saveButton?.props.onPress();
    });

    expect(findNodes(renderer, 'inline-error')[0]?.props.message).toBe(
      'Cada item de custo só pode aparecer uma vez.',
    );
    expect(mockCreateVersion).not.toHaveBeenCalled();
  });

  it('reports an empty quantity separately from a missing item', async () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailCompositionEditScreen, { productId: 'product-1' }));
    });

    const quantityField = findNodes(renderer, 'native-text-field')[0];
    act(() => quantityField.props.onChangeText(''));

    const saveButton = findNodes(renderer, 'native-button').find(
      (node) => node.props.label === 'Salvar composição',
    );
    await act(async () => {
      await saveButton?.props.onPress();
    });

    expect(findNodes(renderer, 'inline-error')[0]?.props.message).toBe(
      'Informe a quantidade de cada componente.',
    );
    expect(mockCreateVersion).not.toHaveBeenCalled();
  });
});
