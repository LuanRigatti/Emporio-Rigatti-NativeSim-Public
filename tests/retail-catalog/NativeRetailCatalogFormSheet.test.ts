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

    expect(mockCategorySubmit).toHaveBeenCalledWith({ label: 'Cestas' });
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
});
