import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';
import { Text } from 'react-native';

import type { Purchase } from '@/features/factory-purchases/types';

// Jest resolves the platform-specific .ios.tsx sibling for extensionless imports.
// This suite intentionally targets the fallback implementation directly.
const { PurchaseDetailsSheet } = jest.requireActual(
  '../../src/features/factory-purchases/components/PurchaseDetailsSheet.tsx',
) as {
  PurchaseDetailsSheet: typeof import('../../src/features/factory-purchases/components/PurchaseDetailsSheet').PurchaseDetailsSheet;
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
  },
}));

const mockRequestAddPayment = jest.fn();

function mockNativeButton(props: { accessibilityLabel: string; onPress: () => void }) {
  return createElement('MockNativeButton', props);
}

function mockNativeSheet({ children }: { children?: ReactNode }) {
  return createElement('MockNativeSheet', null, children);
}

jest.mock('@/components/native', () => ({
  NativeButton: mockNativeButton,
  NativeSheet: mockNativeSheet,
}));

jest.mock('@/components/premium', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    GlassCard: ({ children }: { children?: ReactNode }) =>
      React.createElement('MockGlassCard', null, children),
  };
});

jest.mock('@/theme', () => ({
  getInsetSurfaceColor: jest.fn(() => '#F7F7F7'),
  useAppTheme: () => ({
    resolvedMode: 'light',
    theme: {
      colors: {
        danger: '#FF0000',
        glassSurface: '#FFFFFF',
        textPrimary: '#000000',
        textSecondary: '#666666',
      },
      radius: { xl: 20 },
      spacing: { sm: 8 },
      typography: { body: {}, footnote: {}, headline: {} },
    },
  }),
}));

jest.mock('@/utils/presentation/testModeValues', () => ({
  useTestModePresentation: () => ({
    enabled: false,
    currency: (value: number) => `${value}`,
    number: (value: number) => `${value}`,
  }),
}));

function purchase(): Purchase {
  return {
    bucketQuantity: 10,
    bucketUnitPrice: 35,
    date: '2026-08-05',
    id: 'receipt-1',
    payments: [],
    totalAmount: 350,
  };
}

function renderSheet() {
  let renderer: ReactTestRenderer;
  act(() => {
    renderer = create(
      createElement(PurchaseDetailsSheet, {
        onDismiss: jest.fn(),
        onRequestAddPayment: mockRequestAddPayment,
        onVisibleChange: jest.fn(),
        purchase: purchase(),
        visible: true,
      }),
    );
  });
  return renderer!;
}

describe('PurchaseDetailsSheet payment navigation', () => {
  beforeEach(() => {
    mockRequestAddPayment.mockClear();
  });

  it('keeps purchase details and payment history, and requests navigation with purchaseId', () => {
    const renderer = renderSheet();
    const action = renderer.root.find((node) => String(node.type) === 'MockNativeButton');

    expect(action.props.accessibilityLabel).toBe('Adicionar pagamento');
    act(() => action.props.onPress());

    expect(mockRequestAddPayment).toHaveBeenCalledWith('receipt-1');
    expect(renderer.root.findAll((node) => String(node.type) === 'MockNativeButton')).toHaveLength(
      1,
    );
    expect(
      renderer.root.findAll((node) => String(node.type) === 'MockNativeTextField'),
    ).toHaveLength(0);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'MockNativeDatePicker'),
    ).toHaveLength(0);
    expect(
      renderer.root
        .findAllByType(Text)
        .some((node) => String(node.props.children).includes('Novo pagamento')),
    ).toBe(false);

    act(() => renderer.unmount());
  });
});
