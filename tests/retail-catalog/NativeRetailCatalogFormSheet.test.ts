/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';

import NativeRetailCategoryFormSheetFallback from '@/components/native/NativeRetailCategoryFormSheet/NativeRetailCategoryFormSheetFallback';
import NativeRetailProductFormSheetFallback from '@/components/native/NativeRetailProductFormSheet/NativeRetailProductFormSheetFallback';

const mockCategorySubmit = jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined);
const mockProductSubmit = jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined);
const mockOnVisibleChange = jest.fn();

jest.mock('@/components/native/NativeButton', () => ({
  NativeButton: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-button', props, props.label as ReactNode);
  },
}));
jest.mock('@/components/native/NativeSheet', () => ({
  NativeSheet: ({ children, ...props }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-sheet', props, children);
  },
}));
jest.mock('@/components/native/NativeTextField', () => ({
  NativeTextField: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-text-field', props);
  },
}));
jest.mock('@/components/native/NativeDropdown', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-dropdown', props);
  },
}));
jest.mock('@/theme', () => ({
  useAppTheme: () => ({
    theme: {
      colors: { danger: '#FF0000', textPrimary: '#000000', textSecondary: '#666666' },
      spacing: { md: 16 },
      typography: { body: {}, footnote: {} },
    },
  }),
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

describe('retail catalog form sheets', () => {
  beforeEach(() => {
    mockCategorySubmit.mockClear();
    mockProductSubmit.mockClear();
    mockOnVisibleChange.mockClear();
  });

  it('submits a category through the native-sheet fallback', async () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(NativeRetailCategoryFormSheetFallback, {
          onSubmit: mockCategorySubmit,
          onVisibleChange: mockOnVisibleChange,
          visible: true,
        }),
      );
    });
    const field = findNodes(renderer, 'native-text-field')[0];
    act(() => field.props.onChangeText('Cestas'));
    await act(async () => {
      findNodes(renderer, 'native-button')[0].props.onPress();
      await Promise.resolve();
    });

    expect(mockCategorySubmit).toHaveBeenCalledWith({ financeGroup: 'other', label: 'Cestas' });
    expect(mockOnVisibleChange).toHaveBeenCalledWith(false);
  });

  it('submits the product contract with a zero price and selected category', async () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(NativeRetailProductFormSheetFallback, {
          categories: [{ categoryId: 'cestas', label: 'Cestas' }],
          onSubmit: mockProductSubmit,
          onVisibleChange: mockOnVisibleChange,
          visible: true,
        }),
      );
    });
    const fields = findNodes(renderer, 'native-text-field');
    act(() =>
      fields
        .find((field) => field.props.accessibilityLabel === 'Nome do produto')
        ?.props.onChangeText('Cesta Café'),
    );
    act(() =>
      fields
        .find((field) => field.props.accessibilityLabel === 'Preço de venda')
        ?.props.onChangeText('0'),
    );
    await act(async () => {
      findNodes(renderer, 'native-button')[0].props.onPress();
      await Promise.resolve();
    });

    expect(mockProductSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'cestas',
        productName: 'Cesta Café',
        standardSalePrice: '0',
      }),
    );
    expect(mockOnVisibleChange).toHaveBeenCalledWith(false);
  });

  it('submits the selected direct cost configuration with the product', async () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(NativeRetailProductFormSheetFallback, {
          categories: [{ categoryId: 'cestas', label: 'Cestas' }],
          costItems: [{ costItemId: 'cafe', label: 'Café', unit: 'un' }],
          onSubmit: mockProductSubmit,
          onVisibleChange: mockOnVisibleChange,
          visible: true,
        }),
      );
    });

    act(() => {
      findNodes(renderer, 'native-dropdown')
        .find((node) => node.props.accessibilityLabel === 'Modo de custo')
        ?.props.onValueChange('direct');
    });
    act(() => {
      findNodes(renderer, 'native-dropdown')
        .find((node) => node.props.accessibilityLabel === 'Item de custo direto')
        ?.props.onValueChange('cafe');
    });
    expect(
      renderer.root.findAll((node) =>
        node.children.some(
          (child) =>
            typeof child === 'string' &&
            child.includes('Custo direto usa o histórico do item selecionado em Custos.'),
        ),
      ),
    ).not.toHaveLength(0);
    const fields = findNodes(renderer, 'native-text-field');
    act(() =>
      fields
        .find((field) => field.props.accessibilityLabel === 'Nome do produto')
        ?.props.onChangeText('Cesta Café'),
    );
    act(() =>
      fields
        .find((field) => field.props.accessibilityLabel === 'Preço de venda')
        ?.props.onChangeText('100'),
    );
    await act(async () => {
      findNodes(renderer, 'native-button')[0].props.onPress();
      await Promise.resolve();
    });

    expect(mockProductSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ costMode: 'direct', directCostItemId: 'cafe' }),
    );
  });

  it('shows the resolved current cost and never invents zero when unavailable', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(NativeRetailProductFormSheetFallback, {
          categories: [{ categoryId: 'cestas', label: 'Cestas' }],
          currentCost: {
            cost: 8,
            mode: 'direct',
            referenceDate: '2026-09-18',
            status: 'available',
          },
          initialValues: { costMode: 'direct', directCostItemId: 'cafe' },
          onSubmit: mockProductSubmit,
          onVisibleChange: mockOnVisibleChange,
          visible: true,
        }),
      );
    });

    expect(collectText(renderer.root)).toContain('Custo atual');
    expect(collectText(renderer.root).replace(/\u00a0/g, ' ')).toContain('R$ 8,00');
    expect(collectText(renderer.root)).toContain('Referência:');
    expect(collectText(renderer.root)).not.toContain(
      'Salve as alterações para recalcular o custo atual.',
    );

    act(() => {
      renderer.update(
        createElement(NativeRetailProductFormSheetFallback, {
          categories: [{ categoryId: 'cestas', label: 'Cestas' }],
          currentCost: {
            message: 'Não existe custo histórico válido para essa data.',
            mode: 'direct',
            referenceDate: '2026-09-18',
            status: 'unavailable',
          },
          onSubmit: mockProductSubmit,
          onVisibleChange: mockOnVisibleChange,
          visible: true,
        }),
      );
    });

    expect(collectText(renderer.root)).toContain('Custo indisponível');
    expect(collectText(renderer.root)).not.toContain('R$ 0,00');
  });

  it('does not mark a persisted composition dirty during initial hydration', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(NativeRetailProductFormSheetFallback, {
          categories: [{ categoryId: 'cestas', label: 'Cestas' }],
          currentCost: {
            cost: 5.9,
            mode: 'composition',
            referenceDate: '2026-09-18',
            status: 'available',
          },
          initialValues: { costMode: 'composition' },
          onSubmit: mockProductSubmit,
          onVisibleChange: mockOnVisibleChange,
          visible: true,
        }),
      );
    });

    const text = collectText(renderer.root).replace(/\u00a0/g, ' ');
    expect(text).toContain('Custo atual da composição');
    expect(text).toContain('R$ 5,90');
    expect(text).not.toContain('Salve as alterações para recalcular o custo atual.');
  });

  it('normalizes an absent direct item without creating a false dirty state', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(NativeRetailProductFormSheetFallback, {
          categories: [{ categoryId: 'cestas', label: 'Cestas' }],
          currentCost: {
            cost: 1,
            mode: 'direct',
            referenceDate: '2026-09-18',
            status: 'available',
          },
          initialValues: {
            costMode: 'direct',
            directCostItemId: undefined as unknown as string,
          },
          onSubmit: mockProductSubmit,
          onVisibleChange: mockOnVisibleChange,
          visible: true,
        }),
      );
    });

    const text = collectText(renderer.root).replace(/\u00a0/g, ' ');
    expect(text).toContain('R$ 1,00');
    expect(text).not.toContain('Salve as alterações para recalcular o custo atual.');
  });

  it('keeps the save warning only after a real cost configuration change', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(NativeRetailProductFormSheetFallback, {
          categories: [{ categoryId: 'cestas', label: 'Cestas' }],
          currentCost: {
            cost: 1,
            mode: 'direct',
            referenceDate: '2026-09-18',
            status: 'available',
          },
          initialValues: { costMode: 'direct', directCostItemId: 'cafe' },
          onSubmit: mockProductSubmit,
          onVisibleChange: mockOnVisibleChange,
          visible: true,
        }),
      );
    });

    act(() => {
      findNodes(renderer, 'native-dropdown')
        .find((node) => node.props.accessibilityLabel === 'Modo de custo')
        ?.props.onValueChange('composition');
    });
    expect(collectText(renderer.root)).toContain(
      'Salve as alterações para recalcular o custo atual.',
    );

    act(() => {
      renderer.update(
        createElement(NativeRetailProductFormSheetFallback, {
          categories: [{ categoryId: 'cestas', label: 'Cestas' }],
          currentCost: {
            cost: 1,
            mode: 'direct',
            referenceDate: '2026-09-18',
            status: 'available',
          },
          initialValues: { costMode: 'direct', directCostItemId: 'cafe' },
          onSubmit: mockProductSubmit,
          onVisibleChange: mockOnVisibleChange,
          visible: true,
        }),
      );
    });
    expect(collectText(renderer.root)).toContain(
      'Salve as alterações para recalcular o custo atual.',
    );
  });
});
