/* eslint-disable @typescript-eslint/no-require-imports */

import { Dimensions, StyleSheet, TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement } from 'react';

import { CompanyDataScreen } from '@/features/settings/components/CompanyDataScreen';
import NativeTextFieldExpo from '@/components/native/NativeTextField/NativeTextField.expo';
import NativeTextFieldSwiftUI from '@/components/native/NativeTextField/NativeTextFieldSwiftUI.ios';

let mockResolvedMode: 'light' | 'dark' = 'light';
let mockIsHydrated = true;
let mockProfile = {
  address: 'Rua Francisco Balchak 83',
  legalName: 'Razão social inicial',
  taxId: '61.766.999/0001-79',
  tradeName: 'Emporio Rigatti',
};
const mockUpdateField = jest.fn();
const mockUseNativeState = jest.fn((value: string) => ({ set: jest.fn(), value }));
const mockTheme = {
  colors: {
    glassSurface: '#FFFFFF',
    separator: '#DDDDDD',
    surface: '#FFFFFF',
    textPrimary: '#111111',
    textSecondary: '#555555',
    textTertiary: '#777777',
  },
  radius: { card: 20, md: 12, xl: 22 },
  layout: { screenHorizontalPadding: 16 },
  spacing: { lg: 20, md: 16, xxs: 4, xs: 8 },
  typography: { body: { fontSize: 17 }, footnote: { fontSize: 13 } },
};

jest.mock('@/components/layout', () => {
  const React = require('react') as typeof import('react');
  return {
    NativeGlassHeader: () => React.createElement('native-header'),
  };
});

jest.mock('@/components/native', () => {
  const React = require('react') as typeof import('react');
  return {
    NativeTextField: (props: Record<string, unknown>) =>
      React.createElement('native-text-field', props),
  };
});

jest.mock('@/components/premium', () => {
  const React = require('react') as typeof import('react');
  return {
    GlassCard: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('glass-card', props, children),
    PremiumScreen: ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => React.createElement('premium-screen', props, children),
  };
});

jest.mock('@/hooks/useCompanyProfile', () => ({
  useCompanyProfile: () => ({
    isHydrated: mockIsHydrated,
    profile: mockProfile,
    updateField: mockUpdateField,
  }),
}));

jest.mock('@/theme', () => ({
  useAppTheme: () => ({ resolvedMode: mockResolvedMode, theme: mockTheme }),
}));

jest.mock('@expo/ui/swift-ui', () => {
  const React = require('react') as typeof import('react');
  return {
    Host: (props: Record<string, unknown>) =>
      React.createElement('expo-host', props, props.children as React.ReactNode),
    TextField: ({ ref: _ref, ...props }: Record<string, unknown>) =>
      React.createElement('expo-text-field', props),
    useNativeState: (value: string) => mockUseNativeState(value),
  };
});

jest.mock('@expo/ui/swift-ui/modifiers', () => {
  const createModifier =
    (name: string) =>
    (...args: unknown[]) => ({ name, args });
  return {
    autocorrectionDisabled: createModifier('autocorrectionDisabled'),
    disabled: createModifier('disabled'),
    fixedSize: createModifier('fixedSize'),
    font: createModifier('font'),
    keyboardType: createModifier('keyboardType'),
    lineLimit: createModifier('lineLimit'),
  };
});

function findNodes(renderer: ReactTestRenderer, type: string) {
  return renderer.root.findAll((node) => String(node.type) === type);
}

function render(node: React.ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(node);
  });
  return renderer;
}

describe('CompanyDataScreen', () => {
  beforeEach(() => {
    mockResolvedMode = 'light';
    mockIsHydrated = true;
    mockProfile = {
      address: 'Rua Francisco Balchak 83',
      legalName: 'Razão social inicial',
      taxId: '61.766.999/0001-79',
      tradeName: 'Emporio Rigatti',
    };
    mockUpdateField.mockClear();
  });

  it.each([
    'Rigatti Comércio',
    '61.766.999 LUAN RODRIGO RIGATTI DE OLIVEIRA COMERCIO E DISTRIBUICAO DE PRODUTOS',
  ])('keeps the full legal name in the vertically expanding field: %s', (legalName) => {
    mockProfile.legalName = legalName;

    const renderer = render(createElement(CompanyDataScreen));
    const legalNameField = findNodes(renderer, 'native-text-field').find(
      (node) => node.props.accessibilityLabel === 'Razão social',
    );

    expect(legalNameField?.props.value).toBe(legalName);
    expect(legalNameField?.props.multiline).toBe(true);
    expect(legalNameField?.props.numberOfLines).toBeUndefined();
    expect(legalNameField?.props.style).toBeUndefined();
  });

  it('waits for local hydration before mounting the editable legal-name field', () => {
    mockIsHydrated = false;
    mockProfile.legalName = '';
    const renderer = render(createElement(CompanyDataScreen));

    expect(
      findNodes(renderer, 'native-text-field').some(
        (node) => node.props.accessibilityLabel === 'Razão social',
      ),
    ).toBe(false);

    const hydratedLegalName = '61.766.999 LUAN RODRIGO RIGATTI DE OLIVEIRA';
    mockProfile.legalName = hydratedLegalName;
    mockIsHydrated = true;
    act(() => renderer.update(createElement(CompanyDataScreen)));

    const legalNameField = findNodes(renderer, 'native-text-field').find(
      (node) => node.props.accessibilityLabel === 'Razão social',
    );
    expect(legalNameField?.props.value).toBe(hydratedLegalName);
    expect(legalNameField?.props.multiline).toBe(true);
  });

  it('preserves the other company values, labels, and CNPJ keyboard behavior', () => {
    const renderer = render(createElement(CompanyDataScreen));
    const fields = findNodes(renderer, 'native-text-field');

    expect(fields.map((field) => field.props.accessibilityLabel)).toEqual([
      'Razão social',
      'Nome fantasia',
      'CNPJ',
      'Endereço',
    ]);
    expect(fields.map((field) => field.props.value)).toEqual([
      mockProfile.legalName,
      mockProfile.tradeName,
      mockProfile.taxId,
      mockProfile.address,
    ]);
    expect(fields[1]?.props.multiline).toBeUndefined();
    expect(fields[2]?.props.keyboardType).toBe('number-pad');
    expect(fields[3]?.props.multiline).toBeUndefined();
  });

  it.each(['light', 'dark'] as const)(
    'uses the local larger radius without a fixed card height in %s mode',
    (mode) => {
      mockResolvedMode = mode;
      const renderer = render(createElement(CompanyDataScreen));
      const card = findNodes(renderer, 'glass-card')[0];
      const style = StyleSheet.flatten(card?.props.style);

      expect(style?.borderRadius).toBe(mockTheme.radius.xl + mockTheme.spacing.xxs);
      expect(style?.height).toBeUndefined();
      expect(style?.maxHeight).toBeUndefined();
      expect(style?.gap).toBe(20);
    },
  );

  it('anchors card and legal-name width to the current window and existing theme spacing', () => {
    const renderer = render(createElement(CompanyDataScreen));
    const card = findNodes(renderer, 'glass-card')[0];
    const legalNameField = findNodes(renderer, 'native-text-field').find(
      (node) => node.props.accessibilityLabel === 'Razão social',
    );
    const cardStyle = StyleSheet.flatten(card?.props.style);
    const fieldStyle = StyleSheet.flatten(legalNameField?.parent?.parent?.props.style);
    const expectedCardWidth =
      Dimensions.get('window').width - mockTheme.layout.screenHorizontalPadding * 2;

    expect(cardStyle?.width).toBe(expectedCardWidth);
    expect(fieldStyle?.width).toBe(expectedCardWidth - mockTheme.spacing.lg * 2);
  });
});

describe('NativeTextField multiline sizing', () => {
  const baseProps = {
    onChangeText: jest.fn(),
    value: 'Razão social completa',
  };

  it('uses an unbounded vertical SwiftUI field whose Host takes the available width', () => {
    const renderer = render(
      createElement(NativeTextFieldSwiftUI, { ...baseProps, multiline: true }),
    );
    const host = findNodes(renderer, 'expo-host')[0];
    const field = findNodes(renderer, 'expo-text-field')[0];
    const modifiers = field?.props.modifiers as { name: string; args: unknown[] }[];

    expect(host?.props.matchContents).toEqual({ vertical: true });
    expect(host?.props.style).toEqual({ width: '100%' });
    expect(field?.props.axis).toBe('vertical');
    expect(modifiers).toContainEqual({ name: 'lineLimit', args: [] });
    expect(modifiers).toContainEqual({
      name: 'fixedSize',
      args: [{ horizontal: false, vertical: true }],
    });
    expect(modifiers).toContainEqual({
      name: 'font',
      args: [{ design: 'rounded', textStyle: 'body' }],
    });
  });

  it('seeds SwiftUI native state with the hydrated initial value', () => {
    const hydratedValue = '61.766.999 LUAN RODRIGO RIGATTI DE OLIVEIRA';
    mockUseNativeState.mockClear();

    render(
      createElement(NativeTextFieldSwiftUI, {
        ...baseProps,
        multiline: true,
        value: hydratedValue,
      }),
    );

    expect(mockUseNativeState).toHaveBeenCalledWith(hydratedValue);
  });

  it('keeps ordinary SwiftUI fields single-line', () => {
    const renderer = render(createElement(NativeTextFieldSwiftUI, baseProps));
    const host = findNodes(renderer, 'expo-host')[0];
    const field = findNodes(renderer, 'expo-text-field')[0];
    const modifiers = field?.props.modifiers as { name: string }[];

    expect(host?.props.matchContents).toBe(true);
    expect(field?.props.axis).toBe('horizontal');
    expect(modifiers.some((modifier) => modifier.name === 'lineLimit')).toBe(false);
    expect(modifiers.some((modifier) => modifier.name === 'fixedSize')).toBe(false);
  });

  it('keeps the cross-platform fallback multiline without imposing a line cap or fixed height', () => {
    const renderer = render(createElement(NativeTextFieldExpo, { ...baseProps, multiline: true }));
    const input = renderer.root.findByType(TextInput);
    const style = StyleSheet.flatten(input.props.style);

    expect(input.props.multiline).toBe(true);
    expect(input.props.numberOfLines).toBeUndefined();
    expect(input.props.allowFontScaling).not.toBe(false);
    expect(style?.minHeight).toBe(48);
    expect(style?.height).toBeUndefined();
    expect(style?.maxHeight).toBeUndefined();
  });
});
