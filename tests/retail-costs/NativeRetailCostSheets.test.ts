/* eslint-disable @typescript-eslint/no-require-imports */

import { createElement, type ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import NativeRetailCompositionSheetFallback from '@/components/native/NativeRetailCompositionSheet/NativeRetailCompositionSheetFallback';
import NativeRetailCostItemFormSheetFallback from '@/components/native/NativeRetailCostItemFormSheet/NativeRetailCostItemFormSheetFallback';
import NativeRetailEntryFormSheetFallback from '@/components/native/NativeRetailEntryFormSheet/NativeRetailEntryFormSheetFallback';
import NativeRetailProductCostSheetFallback from '@/components/native/NativeRetailProductCostSheet/NativeRetailProductCostSheetFallback';

const mockCostItemSubmit = jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined);
const mockEntrySubmit = jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined);
const mockProductCostSubmit = jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined);
const mockCompositionSubmit = jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined);
const mockOnVisibleChange = jest.fn();

jest.mock('@/components/native/NativeButton', () => ({
  NativeButton: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-button', props, props.label as ReactNode);
  },
}));
jest.mock('@/components/native/NativeDatePicker', () => ({
  NativeDatePicker: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-date-picker', props);
  },
}));
jest.mock('@/components/native/NativeDropdown', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-dropdown', props);
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
jest.mock('@/theme', () => ({
  useAppTheme: () => ({
    theme: {
      colors: {
        danger: '#FF0000',
        textPrimary: '#000000',
        textSecondary: '#666666',
      },
      spacing: { md: 16 },
      typography: { body: {}, footnote: {} },
    },
  }),
}));
jest.mock('@/utils/data', () => ({
  parseIsoCalendarDate: jest.fn(() => new Date(2026, 0, 1)),
  todayIso: jest.fn((date?: Date) =>
    date
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
          date.getDate(),
        ).padStart(2, '0')}`
      : '2026-01-01',
  ),
}));
jest.mock('@/utils/presentation/testModeValues', () => ({
  useTestModePresentation: () => ({ enabled: false }),
}));

function findNodes(renderer: ReactTestRenderer, type: string): ReactTestInstance[] {
  return renderer.root.findAll((node) => String(node.type) === type);
}

describe('retail cost native sheets', () => {
  beforeEach(() => {
    mockCostItemSubmit.mockClear();
    mockEntrySubmit.mockClear();
    mockProductCostSubmit.mockClear();
    mockCompositionSubmit.mockClear();
    mockOnVisibleChange.mockClear();
  });

  it('creates a cost item through the existing NativeSheet pattern', async () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(NativeRetailCostItemFormSheetFallback, {
          onSubmit: mockCostItemSubmit,
          onVisibleChange: mockOnVisibleChange,
          visible: true,
        }),
      );
    });
    const fields = findNodes(renderer, 'native-text-field');
    act(() => fields[0]?.props.onChangeText('Café'));
    act(() => fields[1]?.props.onChangeText('kg'));
    await act(async () => {
      findNodes(renderer, 'native-button')[0]?.props.onPress();
      await Promise.resolve();
    });

    expect(mockCostItemSubmit).toHaveBeenCalledWith({ name: 'Café', supplier: '', unit: 'kg' });
    expect(mockOnVisibleChange).toHaveBeenCalledWith(false);
  });

  it('adds a historical entry and leaves unit conversion to the caller contract', async () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(NativeRetailEntryFormSheetFallback, {
          itemUnit: 'kg',
          onSubmit: mockEntrySubmit,
          onVisibleChange: mockOnVisibleChange,
          visible: true,
        }),
      );
    });
    const fields = findNodes(renderer, 'native-text-field');
    act(() =>
      fields
        .find((field) => field.props.accessibilityLabel === 'Quantidade comprada')
        ?.props.onChangeText('2'),
    );
    act(() =>
      fields
        .find((field) => field.props.accessibilityLabel === 'Custo total da compra')
        ?.props.onChangeText('40'),
    );
    await act(async () => {
      findNodes(renderer, 'native-button')[0]?.props.onPress();
      await Promise.resolve();
    });

    expect(mockEntrySubmit).toHaveBeenCalledWith({
      effectiveDate: '2026-01-01',
      purchaseTotalCost: '40',
      purchasedQuantity: '2',
      supplier: '',
    });
  });

  it('edits only the effective date of an existing historical entry', async () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(NativeRetailEntryFormSheetFallback, {
          initialValues: {
            effectiveDate: '2026-01-20',
            purchaseTotalCost: '40',
            purchasedQuantity: '2',
            supplier: 'Fornecedor',
          },
          itemUnit: 'kg',
          mode: 'edit',
          onSubmit: mockEntrySubmit,
          onVisibleChange: mockOnVisibleChange,
          visible: true,
        }),
      );
    });

    const datePicker = findNodes(renderer, 'native-date-picker')[0];
    const fields = findNodes(renderer, 'native-text-field');
    expect(fields.every((field) => field.props.disabled === true)).toBe(true);
    expect(findNodes(renderer, 'native-button')[0]?.props.label).toBe('Salvar vigência');
    expect(findNodes(renderer, 'native-sheet')[0]?.props.title).toBe('Editar vigência do custo');

    act(() => datePicker?.props.onChange(new Date(2026, 0, 10)));
    await act(async () => {
      findNodes(renderer, 'native-button')[0]?.props.onPress();
      await Promise.resolve();
    });

    expect(mockEntrySubmit).toHaveBeenCalledWith({
      effectiveDate: '2026-01-10',
      purchaseTotalCost: '40',
      purchasedQuantity: '2',
      supplier: 'Fornecedor',
    });
  });

  it('configures a product for direct cost through the product cost sheet', async () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(NativeRetailProductCostSheetFallback, {
          costItems: [{ costItemId: 'coffee', label: 'Café', unit: 'unidade' }],
          onSubmit: mockProductCostSubmit,
          onVisibleChange: mockOnVisibleChange,
          visible: true,
        }),
      );
    });
    const modeDropdown = findNodes(renderer, 'native-dropdown')[0];
    act(() => modeDropdown.props.onValueChange('direct'));
    const itemDropdown = findNodes(renderer, 'native-dropdown')[1];
    act(() => itemDropdown.props.onValueChange('coffee'));
    await act(async () => {
      const buttons = findNodes(renderer, 'native-button');
      buttons[buttons.length - 1]?.props.onPress();
      await Promise.resolve();
    });

    expect(mockProductCostSubmit).toHaveBeenCalledWith({
      costMode: 'direct',
      directCostItemId: 'coffee',
    });
  });

  it('submits a composition with effective date and component quantities', async () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(NativeRetailCompositionSheetFallback, {
          costItems: [{ costItemId: 'coffee', label: 'Café', unit: 'unidade' }],
          initialValues: {
            components: [{ costItemId: 'coffee', key: 'component-1', quantity: '2' }],
            effectiveFrom: '2026-01-01',
          },
          onSubmit: mockCompositionSubmit,
          onVisibleChange: mockOnVisibleChange,
          visible: true,
        }),
      );
    });
    const quantity = findNodes(renderer, 'native-text-field')[0];
    act(() => quantity.props.onChangeText('3'));
    await act(async () => {
      const buttons = findNodes(renderer, 'native-button');
      buttons[buttons.length - 1]?.props.onPress();
      await Promise.resolve();
    });

    expect(mockCompositionSubmit).toHaveBeenCalledWith({
      components: [{ costItemId: 'coffee', key: 'component-1', quantity: '3' }],
      effectiveFrom: '2026-01-01',
    });
    expect(mockOnVisibleChange).toHaveBeenCalledWith(false);
  });

  it('keeps same-name cost item IDs distinguishable and saves only the remaining IDs', async () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(NativeRetailCompositionSheetFallback, {
          costItems: [
            { costItemId: 'valid-croassaint', label: 'Croassaint', unit: 'unidade' },
            { costItemId: 'stale-croassaint', label: 'Croassaint', unit: 'unidade' },
            { costItemId: 'drip', label: 'Drip', unit: 'unidade' },
          ],
          initialValues: {
            components: [
              { costItemId: 'valid-croassaint', key: 'valid', quantity: '1' },
              { costItemId: 'stale-croassaint', key: 'stale', quantity: '1' },
            ],
            effectiveFrom: '2026-01-01',
          },
          onSubmit: mockCompositionSubmit,
          onVisibleChange: mockOnVisibleChange,
          visible: true,
        }),
      );
    });

    const dropdown = findNodes(renderer, 'native-dropdown')[0];
    const duplicateLabels = dropdown?.props.items
      .filter((item: { value: string }) => item.value !== 'drip')
      .map((item: { label: string }) => item.label);
    expect(new Set(duplicateLabels).size).toBe(2);
    expect(duplicateLabels?.every((label: string) => label.includes('…'))).toBe(true);
    expect(duplicateLabels?.some((label: string) => label.includes('valid-croassaint'))).toBe(
      false,
    );
    expect(duplicateLabels?.some((label: string) => label.includes('stale-croassaint'))).toBe(
      false,
    );

    const removeButtons = findNodes(renderer, 'native-button').filter(
      (button) => button.props.label === 'Remover',
    );
    act(() => removeButtons[1]?.props.onPress());
    await act(async () => {
      findNodes(renderer, 'native-button')
        .find((button) => button.props.label === 'Salvar composição')
        ?.props.onPress();
      await Promise.resolve();
    });

    expect(mockCompositionSubmit).toHaveBeenCalledWith({
      components: [{ costItemId: 'valid-croassaint', key: 'valid', quantity: '1' }],
      effectiveFrom: '2026-01-01',
    });
  });

  it('blocks selecting the same cost item ID in two component rows', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(NativeRetailCompositionSheetFallback, {
          costItems: [
            { costItemId: 'croassaint', label: 'Croassaint', unit: 'unidade' },
            { costItemId: 'drip', label: 'Drip', unit: 'unidade' },
          ],
          initialValues: {
            components: [
              { costItemId: 'croassaint', key: 'first', quantity: '1' },
              { costItemId: 'drip', key: 'second', quantity: '1' },
            ],
            effectiveFrom: '2026-01-01',
          },
          onSubmit: mockCompositionSubmit,
          onVisibleChange: mockOnVisibleChange,
          visible: true,
        }),
      );
    });

    act(() => findNodes(renderer, 'native-dropdown')[1]?.props.onValueChange('croassaint'));

    expect(findNodes(renderer, 'native-dropdown')[1]?.props.selectedValue).toBe('drip');
  });

  it('uses unit before a short identifier for homonyms and hides IDs for unique names', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(NativeRetailCompositionSheetFallback, {
          costItems: [
            { costItemId: 'unit', label: 'Croassaint', unit: 'unidade' },
            { costItemId: 'package', label: 'Croassaint', unit: 'pacote' },
            { costItemId: 'drip', label: 'Drip', unit: 'unidade' },
          ],
          initialValues: {
            components: [{ costItemId: 'drip', key: 'drip', quantity: '1' }],
            effectiveFrom: '2026-01-01',
          },
          onSubmit: mockCompositionSubmit,
          onVisibleChange: mockOnVisibleChange,
          visible: true,
        }),
      );
    });

    const labels = findNodes(renderer, 'native-dropdown')[0]?.props.items.map(
      (item: { label: string }) => item.label,
    );
    expect(labels).toEqual(['Croassaint — unidade', 'Croassaint — pacote', 'Drip']);
    expect(labels?.every((label: string) => !label.includes('ID'))).toBe(true);
  });

  it('keeps persisted inactive items visible but excludes them from new components', async () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(NativeRetailCompositionSheetFallback, {
          costItems: [
            { active: true, costItemId: 'active', label: 'Drip', unit: 'unidade' },
            { active: false, costItemId: 'inactive', label: 'Croassaint', unit: 'unidade' },
          ],
          initialValues: {
            components: [{ costItemId: 'inactive', key: 'inactive', quantity: '1' }],
            effectiveFrom: '2026-01-01',
          },
          onSubmit: mockCompositionSubmit,
          onVisibleChange: mockOnVisibleChange,
          visible: true,
        }),
      );
    });

    expect(findNodes(renderer, 'native-dropdown')[0]?.props.items).toEqual([
      { label: 'Drip', value: 'active' },
      { label: 'Croassaint (desativado)', value: 'inactive' },
    ]);

    await act(async () => {
      findNodes(renderer, 'native-button')
        .find((button) => button.props.label === 'Salvar composição')
        ?.props.onPress();
      await Promise.resolve();
    });
    expect(mockCompositionSubmit).toHaveBeenCalledWith({
      components: [{ costItemId: 'inactive', key: 'inactive', quantity: '1' }],
      effectiveFrom: '2026-01-01',
    });
    mockCompositionSubmit.mockClear();

    act(() =>
      findNodes(renderer, 'native-button')
        .find((button) => button.props.label === 'Adicionar componente')
        ?.props.onPress(),
    );

    expect(findNodes(renderer, 'native-dropdown')[1]?.props.selectedValue).toBe('active');
    expect(findNodes(renderer, 'native-dropdown')[1]?.props.items).toEqual([
      { label: 'Drip', value: 'active' },
    ]);
  });
});
