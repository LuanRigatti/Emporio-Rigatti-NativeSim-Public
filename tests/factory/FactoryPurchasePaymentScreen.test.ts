/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { Text } from 'react-native';

const mockRouterBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockRouterBack }),
}));

jest.mock('@/components/layout', () => {
  const React = require('react') as typeof import('react');
  return {
    getNativeLargeTitleStyle: jest.fn(() => ({})),
    NativeGlassHeader: ({ title }: { title: ReactNode }) =>
      React.createElement('native-header', null, title),
  };
});

jest.mock('@/components/native', () => {
  const React = require('react') as typeof import('react');
  return {
    NativeDatePicker: (props: Record<string, unknown>) =>
      React.createElement('native-date-picker', props),
    NativeTextField: (props: Record<string, unknown>) =>
      React.createElement('native-text-field', props),
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
        danger: '#D00',
        surface: '#FFFFFF',
        textPrimary: '#111111',
      },
      layout: { screenHorizontalPadding: 20, tabBarHeight: 84 },
      radius: { xl: 22 },
      spacing: { md: 16, sm: 12, xl: 24, xxs: 4, xs: 8, xxl: 32 },
      typography: { body: {}, headline: {}, footnote: {} },
    },
  }),
}));

jest.mock('@/utils/presentation/testModeValues', () => ({
  useTestModePresentation: () => ({ enabled: false }),
}));

const { FactoryPurchasePaymentScreen } =
  require('../../src/features/factory-purchases/components/FactoryPurchasePaymentScreen') as {
    FactoryPurchasePaymentScreen: ComponentType<{
      purchaseId?: string;
      onAddPayment: (
        purchaseId: string,
        payment: { amount: number; date: string },
      ) => Promise<unknown>;
    }>;
  };

function renderScreen(onAddPayment: jest.Mock, purchaseId = 'purchase-42') {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(FactoryPurchasePaymentScreen, { onAddPayment, purchaseId }));
  });
  return renderer;
}

function input(renderer: ReactTestRenderer) {
  return findMock(renderer, 'native-text-field');
}

function submitButton(renderer: ReactTestRenderer) {
  return findMock(renderer, 'retail-primary-button');
}

function findMock(renderer: ReactTestRenderer, type: string): ReactTestInstance {
  return renderer.root.find((node) => String(node.type) === type);
}

describe('FactoryPurchasePaymentScreen', () => {
  beforeEach(() => {
    mockRouterBack.mockClear();
  });

  it('submits the selected date and parsed amount, then returns to purchase details', async () => {
    const onAddPayment = jest.fn(async () => undefined);
    const renderer = renderScreen(onAddPayment);
    const paymentDate = new Date(2026, 9, 1, 12);

    expect(renderer.root.findAll((node) => String(node.type) === 'premium-card')).toHaveLength(1);
    expect(findMock(renderer, 'native-header').props.children).toBe('Novo pagamento');
    expect(submitButton(renderer).props.label).toBe('Adicionar');
    expect(findMock(renderer, 'sticky-action-footer')).toBeDefined();

    act(() => {
      findMock(renderer, 'native-date-picker').props.onChange(paymentDate);
      input(renderer).props.onChangeText('R$ 125,50');
    });

    await act(async () => {
      await submitButton(renderer).props.onPress();
    });

    expect(onAddPayment).toHaveBeenCalledWith('purchase-42', {
      amount: 125.5,
      date: '2026-10-01',
    });
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
  });

  it('keeps the page open and shows service validation for an overpayment', async () => {
    const onAddPayment = jest.fn(async () => {
      throw new Error('O pagamento excede o saldo restante.');
    });
    const renderer = renderScreen(onAddPayment);

    act(() => input(renderer).props.onChangeText('R$ 500,00'));
    await act(async () => {
      await submitButton(renderer).props.onPress();
    });

    expect(onAddPayment).toHaveBeenCalledTimes(1);
    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(
      renderer.root
        .findAllByType(Text)
        .some((node) =>
          String(node.props.children).includes('O pagamento excede o saldo restante.'),
        ),
    ).toBe(true);
    act(() => renderer.unmount());
  });

  it('blocks an empty amount before calling the payment mutation', async () => {
    const onAddPayment = jest.fn(async () => undefined);
    const renderer = renderScreen(onAddPayment);

    await act(async () => {
      await submitButton(renderer).props.onPress();
    });

    expect(onAddPayment).not.toHaveBeenCalled();
    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(
      renderer.root
        .findAllByType(Text)
        .some((node) =>
          String(node.props.children).includes('Informe um valor de pagamento maior que zero.'),
        ),
    ).toBe(true);
    act(() => renderer.unmount());
  });
});
