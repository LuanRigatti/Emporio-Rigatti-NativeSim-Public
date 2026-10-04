/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactElement } from 'react';

const mockUseLocalSearchParams = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('@/features/factory-purchases/components/FactoryPurchaseDetailsScreen', () => {
  const React = require('react') as typeof import('react');
  return {
    FactoryPurchaseDetailsScreen: (props: Record<string, unknown>) =>
      React.createElement('factory-purchase-details-screen', props),
  };
});

const { default: FactoryPurchaseDetailsRoute } =
  require('../../src/app/fabrica-compras/[purchaseId]/index') as {
    default: () => ReactElement;
  };

function renderRoute(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(FactoryPurchaseDetailsRoute));
  });
  return renderer;
}

describe('FactoryPurchaseDetailsRoute', () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReset();
  });

  it('passes only purchaseId to the full-page details screen', () => {
    mockUseLocalSearchParams.mockReturnValue({ purchaseId: 'receipt-17' });

    const renderer = renderRoute();
    const screen = renderer.root.find(
      (node) => String(node.type) === 'factory-purchase-details-screen',
    );

    expect(screen.props.purchaseId).toBe('receipt-17');
    expect(Object.keys(screen.props)).toEqual(['purchaseId']);
    act(() => renderer.unmount());
  });

  it('normalizes repeated route params to one purchaseId', () => {
    mockUseLocalSearchParams.mockReturnValue({ purchaseId: ['receipt-18', 'ignored'] });

    const renderer = renderRoute();
    const screen = renderer.root.find(
      (node) => String(node.type) === 'factory-purchase-details-screen',
    );

    expect(screen.props.purchaseId).toBe('receipt-18');
    act(() => renderer.unmount());
  });
});
