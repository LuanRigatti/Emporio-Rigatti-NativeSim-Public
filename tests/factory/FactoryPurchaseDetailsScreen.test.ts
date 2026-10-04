/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { Text } from 'react-native';

import type { Purchase } from '@/features/factory-purchases/types';

const mockRouterPush = jest.fn();
let mockPurchase: Purchase | null = null;

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
  },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock('@/hooks/useFactoryPurchases', () => ({
  useFactoryPurchaseById: () => mockPurchase,
}));

jest.mock('@/components/layout', () => {
  const React = require('react') as typeof import('react');
  return {
    getNativeLargeTitleStyle: jest.fn(() => ({})),
    NativeGlassHeader: ({ title }: { title: ReactNode }) =>
      React.createElement('native-header', null, title),
  };
});

jest.mock('@/components/premium', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    PremiumCard: ({ children }: { children?: ReactNode }) =>
      React.createElement('premium-card', null, children),
    ProgressiveCollapsibleScreen: ({
      children,
      largeTitle,
    }: {
      children?: ReactNode;
      largeTitle?: ReactNode;
    }) => React.createElement('progressive-collapsible-screen', null, largeTitle, children),
  };
});

jest.mock('@/components/premium/StickyActionFooter', () => {
  const React = require('react') as typeof import('react');
  return {
    StickyActionFooter: ({ children }: { children?: ReactNode }) =>
      React.createElement('sticky-action-footer', null, children),
  };
});

jest.mock('@/features/retail-orders/components/RetailOrderPrimaryButton', () => {
  const React = require('react') as typeof import('react');
  return {
    RetailOrderPrimaryButton: (props: Record<string, unknown>) =>
      React.createElement('retail-primary-button', props),
  };
});

jest.mock('@/providers', () => ({ useAppSafeAreaInsets: () => ({ bottom: 34 }) }));

jest.mock('@/theme', () => ({
  getCardSurfaceColor: jest.fn(() => '#FFFFFF'),
  useAppTheme: () => ({
    resolvedMode: 'light',
    theme: {
      colors: {
        background: '#FAFAFA',
        surface: '#FFFFFF',
        textPrimary: '#111111',
        textSecondary: '#666666',
      },
      layout: { screenHorizontalPadding: 20, tabBarHeight: 84 },
      radius: { xl: 22 },
      spacing: { md: 16, sm: 12, xl: 24, xxs: 4, xs: 8, xxl: 32 },
      typography: { body: {}, headline: {}, footnote: {} },
    },
  }),
}));

jest.mock('@/utils/data', () => ({
  formatPtBrDate: (value: string) => `data:${value}`,
}));

jest.mock('@/utils/presentation/testModeValues', () => ({
  useTestModePresentation: () => ({
    currency: (value: number) => `R$ ${value.toFixed(2)}`,
    enabled: false,
    number: (value: number) => String(value),
  }),
}));

const { FactoryPurchaseDetailsScreen } =
  require('../../src/features/factory-purchases/components/FactoryPurchaseDetailsScreen') as {
    FactoryPurchaseDetailsScreen: ComponentType<{ purchaseId?: string }>;
  };

function basePurchase(): Purchase {
  return {
    bucketQuantity: 10,
    bucketUnitPrice: 35,
    date: '2026-08-05',
    id: 'receipt-1',
    payments: [],
    totalAmount: 350,
  };
}

function renderScreen(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(FactoryPurchaseDetailsScreen, { purchaseId: 'receipt-1' }));
  });
  return renderer;
}

function findMock(renderer: ReactTestRenderer, type: string): ReactTestInstance {
  return renderer.root.find((node) => String(node.type) === type);
}

function renderedText(renderer: ReactTestRenderer): string[] {
  return renderer.root.findAllByType(Text).map((node) => String(node.props.children));
}

describe('FactoryPurchaseDetailsScreen', () => {
  beforeEach(() => {
    mockRouterPush.mockReset();
    mockPurchase = basePurchase();
  });

  it('shows purchase details and empty payment history, then pushes the payment page', () => {
    const renderer = renderScreen();

    expect(findMock(renderer, 'native-header').props.children).toBe('Detalhes da compra');
    expect(renderedText(renderer)).toEqual(
      expect.arrayContaining([
        'Data',
        'data:2026-08-05',
        'Baldes',
        '10',
        'Valor do balde',
        'R$ 35.00',
        'Valor total',
        'R$ 350.00',
        'Total pago',
        'R$ 0.00',
        'Saldo restante',
        'Status',
        'Em aberto',
        'Histórico de pagamentos',
        'Nenhum pagamento registrado.',
      ]),
    );
    expect(findMock(renderer, 'sticky-action-footer')).toBeDefined();
    const button = findMock(renderer, 'retail-primary-button');
    expect(button.props.label).toBe('Adicionar pagamento');
    act(() => button.props.onPress());
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/fabrica-compras/[purchaseId]/pagamento',
      params: { purchaseId: 'receipt-1' },
    });

    act(() => renderer.unmount());
  });

  it('shows existing payment history and hides the action when fully paid', () => {
    mockPurchase = {
      ...basePurchase(),
      payments: [{ amount: 350, date: '2026-08-07', id: 'payment-1' }],
    };
    const renderer = renderScreen();

    expect(renderedText(renderer)).toEqual(
      expect.arrayContaining(['data:2026-08-07', 'R$ 350.00', 'R$ 0.00', 'Pago']),
    );
    expect(
      renderer.root.findAll((node) => String(node.type) === 'sticky-action-footer'),
    ).toHaveLength(0);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'retail-primary-button'),
    ).toHaveLength(0);

    act(() => renderer.unmount());
  });

  it('does not show the payment action if the purchase is missing', () => {
    mockPurchase = null;
    const renderer = renderScreen();

    expect(renderedText(renderer)).toContain('Compra não encontrada.');
    expect(
      renderer.root.findAll((node) => String(node.type) === 'sticky-action-footer'),
    ).toHaveLength(0);

    act(() => renderer.unmount());
  });
});
