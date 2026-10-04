/* eslint-disable @typescript-eslint/no-require-imports */

import { createElement, type ComponentType, type ReactNode } from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import type { Purchase } from '@/features/factory-purchases/types';

const mockRouterPush = jest.fn();
let mockResolvedMode: 'light' | 'dark' = 'light';
let mockPurchases: Purchase[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock('@/components/native', () => {
  const React = require('react') as typeof import('react');

  return {
    NativeButton: (props: Record<string, unknown>) => React.createElement('native-button', props),
    NativeCardContextMenu: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    NativeDatePicker: () => null,
    NativeTextField: () => null,
  };
});

jest.mock('@/components/overlays', () => ({ ConfirmationDialog: () => null }));

jest.mock('@/components/premium', () => {
  const React = require('react') as typeof import('react');

  return {
    GlassCard: ({ children }: { children?: ReactNode }) =>
      React.createElement('glass-card', null, children),
    PremiumScreen: ({ children }: { children?: ReactNode }) =>
      React.createElement('premium-screen', null, children),
    ProgressiveCollapsibleScreen: ({ children }: { children?: ReactNode }) =>
      React.createElement('progressive-collapsible-screen', null, children),
  };
});

jest.mock('@/hooks/useFactoryPurchases', () => ({
  useFactoryPurchases: () => ({
    createPurchase: jest.fn(),
    dataUnavailable: false,
    deletePurchase: jest.fn(),
    purchases: mockPurchases,
  }),
}));

jest.mock('@/hooks/useFactorySettings', () => ({
  useFactorySettings: () => ({ settings: { bucketCost: 35 } }),
}));

jest.mock('@/services/factory-purchases', () => ({
  factoryPurchaseCalculationService: {
    filterByPeriod: (purchases: Purchase[]) => purchases,
    isPaid: (purchase: Purchase) =>
      purchase.payments.reduce((total, payment) => total + payment.amount, 0) >=
      purchase.totalAmount,
    paidAmount: (purchase: Purchase) =>
      purchase.payments.reduce((total, payment) => total + payment.amount, 0),
    remainingAmount: (purchase: Purchase) =>
      purchase.totalAmount -
      purchase.payments.reduce((total, payment) => total + payment.amount, 0),
    summarize: (purchases: Purchase[]) => ({
      openValue: 0,
      totalBuckets: purchases.reduce((total, purchase) => total + purchase.bucketQuantity, 0),
      totalPaid: 0,
    }),
  },
}));

jest.mock('@/theme', () => ({
  getCardSurfaceColor: jest.fn(() => '#FEFFFF'),
  getLiquidGlassTint: jest.fn(() => 'rgba(0, 0, 0, 0.2)'),
  useAppTheme: () => ({
    resolvedMode: mockResolvedMode,
    theme: {
      colors: {
        contrastContent: mockResolvedMode === 'light' ? '#FFFFFF' : '#000000',
        contrastSurface: mockResolvedMode === 'light' ? '#000000' : '#FFFFFF',
        danger: '#FF0000',
        glassSurface: mockResolvedMode === 'light' ? '#FEFFFF' : '#0C0C0E',
        paid: '#008000',
        textPrimary: mockResolvedMode === 'light' ? '#111111' : '#F5F5F5',
        textSecondary: mockResolvedMode === 'light' ? '#666666' : '#AAAAAA',
      },
      radius: { xl: 24 },
      shadows: { elevated: {}, none: {} },
      spacing: { lg: 24, sm: 12, xs: 8 },
      typography: { body: {}, callout: {}, caption: {}, footnote: {}, headline: {} },
    },
  }),
}));

jest.mock('@/utils/data', () => ({
  formatPtBrDate: (value: string) => `data:${value}`,
  normalizeMoney: (value: number) => value,
  todayIso: () => '2026-10-01',
}));

jest.mock('@/utils/presentation/testModeValues', () => ({
  useTestModePresentation: () => ({
    currency: (value: number) => `R$ ${value.toFixed(2)}`,
    enabled: false,
    number: (value: number) => String(value),
    quantity: (value: number) => String(value),
  }),
}));

const { FactoryPurchasesScreen } =
  require('../../src/features/factory-purchases/components/FactoryPurchasesScreen') as {
    FactoryPurchasesScreen: ComponentType<{
      header: ReactNode;
      mode?: 'all' | 'purchases' | 'register';
      selectedMonth: number;
      selectedYear: number;
    }>;
  };

function fixturePurchases(): Purchase[] {
  return [
    {
      bucketQuantity: 4,
      bucketUnitPrice: 35,
      date: '2026-09-25',
      id: 'open-purchase',
      payments: [],
      totalAmount: 140,
    },
    {
      bucketQuantity: 6,
      bucketUnitPrice: 35,
      date: '2026-09-26',
      id: 'paid-purchase',
      payments: [{ amount: 210, date: '2026-09-26', id: 'payment-1' }],
      totalAmount: 210,
    },
  ];
}

function renderScreen(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;

  act(() => {
    renderer = create(
      createElement(FactoryPurchasesScreen, {
        header: createElement(Text, null, 'Fábrica'),
        mode: 'purchases',
        selectedMonth: 9,
        selectedYear: 2026,
      }),
    );
  });

  return renderer;
}

describe('Factory purchase card Add buttons', () => {
  beforeEach(() => {
    mockResolvedMode = 'light';
    mockPurchases = fixturePurchases();
    mockRouterPush.mockReset();
  });

  it.each([
    ['light', '#000000', '#FFFFFF'],
    ['dark', '#FFFFFF', '#000000'],
  ] as const)(
    'uses the semantic filled CTA in %s mode for open and paid purchases',
    (mode, expectedSurface, expectedContent) => {
      mockResolvedMode = mode;
      const renderer = renderScreen();
      const buttons = renderer.root.findAll((node) => String(node.type) === 'native-button');

      expect(renderer.root.findAllByType(Text).map((node) => String(node.props.children))).toEqual(
        expect.arrayContaining(['Em aberto', 'Pago']),
      );
      expect(buttons).toHaveLength(2);

      for (const button of buttons) {
        expect(button.props).toMatchObject({
          accessibilityLabel: 'Adicionar detalhes da compra',
          backgroundColor: expectedSurface,
          color: expectedContent,
          haptic: 'light',
          label: 'Adicionar',
          variant: 'filled',
        });
        expect(button.props).not.toHaveProperty('glassTint');
      }

      act(() => {
        buttons.forEach((button) => button.props.onPress());
      });

      expect(mockRouterPush).toHaveBeenNthCalledWith(1, {
        pathname: '/fabrica-compras/[purchaseId]',
        params: { purchaseId: 'open-purchase' },
      });
      expect(mockRouterPush).toHaveBeenNthCalledWith(2, {
        pathname: '/fabrica-compras/[purchaseId]',
        params: { purchaseId: 'paid-purchase' },
      });

      act(() => renderer.unmount());
    },
  );
});
