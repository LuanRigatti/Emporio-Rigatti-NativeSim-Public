/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactElement } from 'react';

const mockUseLocalSearchParams = jest.fn();
const mockAddPayment = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('@/hooks/useFactoryPurchases', () => ({
  useAddFactoryPurchasePayment: () => mockAddPayment,
}));

jest.mock('@/features/factory-purchases/components/FactoryPurchasePaymentScreen', () => {
  const React = require('react') as typeof import('react');
  return {
    FactoryPurchasePaymentScreen: (props: Record<string, unknown>) =>
      React.createElement('factory-payment-screen', props),
  };
});

const { default: FactoryPurchasePaymentRoute } =
  require('../../src/app/fabrica-compras/[purchaseId]/pagamento') as {
    default: () => ReactElement;
  };

function renderRoute(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(FactoryPurchasePaymentRoute));
  });
  return renderer;
}

describe('FactoryPurchasePaymentRoute', () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReset();
    mockAddPayment.mockReset();
  });

  it('passes only purchaseId and the shared payment mutation to the page', () => {
    mockUseLocalSearchParams.mockReturnValue({ purchaseId: 'receipt-17' });

    const renderer = renderRoute();
    const screen = renderer.root.find((node) => String(node.type) === 'factory-payment-screen');

    expect(screen.props.purchaseId).toBe('receipt-17');
    expect(screen.props.onAddPayment).toBe(mockAddPayment);
    expect(Object.keys(screen.props).sort()).toEqual(['onAddPayment', 'purchaseId']);
    act(() => renderer.unmount());
  });

  it('normalizes repeated route params to a single purchaseId', () => {
    mockUseLocalSearchParams.mockReturnValue({ purchaseId: ['receipt-18', 'ignored'] });

    const renderer = renderRoute();
    const screen = renderer.root.find((node) => String(node.type) === 'factory-payment-screen');

    expect(screen.props.purchaseId).toBe('receipt-18');
    act(() => renderer.unmount());
  });
});
