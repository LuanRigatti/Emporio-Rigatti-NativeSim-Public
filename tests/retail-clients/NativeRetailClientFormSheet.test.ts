/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';

import { NativeRetailClientFormSheet } from '@/components/native/NativeRetailClientFormSheet';

const mockSubmit = jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined);
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
jest.mock('@/components/native/NativeToggle', () => ({
  NativeToggle: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-toggle', props);
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

function renderForm(initialValues?: Record<string, unknown>) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      createElement(NativeRetailClientFormSheet, {
        initialValues,
        onSubmit: mockSubmit,
        onVisibleChange: mockOnVisibleChange,
        visible: true,
      }),
    );
  });
  return renderer;
}

describe('NativeRetailClientFormSheet', () => {
  beforeEach(() => {
    mockSubmit.mockClear();
    mockOnVisibleChange.mockClear();
  });

  it('submits retail fields and accepts a zero delivery fee', async () => {
    const renderer = renderForm();
    const fields = findNodes(renderer, 'native-text-field');
    const toggle = findNodes(renderer, 'native-toggle')[0];
    const button = findNodes(renderer, 'native-button')[0];

    act(() =>
      fields.find((field) => field.props.accessibilityLabel === 'Nome')?.props.onChangeText('Ana'),
    );
    act(() =>
      fields
        .find((field) => field.props.accessibilityLabel === 'Taxa padrão de entrega')
        ?.props.onChangeText('0'),
    );
    act(() => toggle.props.onValueChange(true));

    const referralFields = findNodes(renderer, 'native-text-field');
    act(() =>
      referralFields
        .find((field) => field.props.accessibilityLabel === 'Tipo ou origem da indicação')
        ?.props.onChangeText('Instagram'),
    );

    await act(async () => {
      button.props.onPress();
      await Promise.resolve();
    });

    expect(mockSubmit).toHaveBeenCalledWith({
      address: '',
      defaultDeliveryFee: '0',
      hasReferral: true,
      name: 'Ana',
      phone: '',
      referredByName: '',
      sourceType: 'Instagram',
    });
    expect(mockOnVisibleChange).toHaveBeenCalledWith(false);
  });

  it('hydrates edit fields without introducing wholesale-only fields', () => {
    const renderer = renderForm({
      defaultDeliveryFee: '12.5',
      hasReferral: false,
      name: 'Café Portugal',
      phone: '9999',
    });

    const fields = findNodes(renderer, 'native-text-field');
    expect(fields.find((field) => field.props.accessibilityLabel === 'Nome')?.props.value).toBe(
      'Café Portugal',
    );
    expect(
      fields.find((field) => field.props.accessibilityLabel === 'Taxa padrão de entrega')?.props
        .value,
    ).toBe('12.5');
    expect(fields.some((field) => field.props.accessibilityLabel === 'Valor do balde')).toBe(false);
  });
});
