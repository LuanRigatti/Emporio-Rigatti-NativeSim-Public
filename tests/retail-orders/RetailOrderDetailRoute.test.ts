/* eslint-disable @typescript-eslint/no-require-imports */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement, type ComponentType } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const routeParams: { orderId?: string | string[] } = { orderId: 'order-1' };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => routeParams,
}));

jest.mock('@/features/retail-orders/components/RetailOrderDetailScreen', () => ({
  RetailOrderDetailScreen: (props: { orderId?: string }) =>
    require('react').createElement('retail-order-detail', props),
}));

const RetailOrderDetailRoute = require('@/app/pedido-varejo/[orderId]').default as ComponentType;

describe('RetailOrderDetailRoute', () => {
  beforeEach(() => {
    routeParams.orderId = 'order-1';
  });

  it('passes only the normalized orderId to the Retail detail screen', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailOrderDetailRoute));
    });

    const detail = renderer.root.find((node) => String(node.type) === 'retail-order-detail');
    expect(detail.props).toEqual({ orderId: 'order-1' });
  });

  it('normalizes an array route parameter without passing the order object', () => {
    routeParams.orderId = ['order-2', 'ignored'];
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailOrderDetailRoute));
    });

    const detail = renderer.root.find((node) => String(node.type) === 'retail-order-detail');
    expect(detail.props).toEqual({ orderId: 'order-2' });
  });

  it('registers the detail page in the Root Stack with the stable native header contract', () => {
    const rootLayoutSource = readFileSync(resolve(process.cwd(), 'src/app/_layout.tsx'), 'utf8');
    expect(rootLayoutSource).toContain('name="pedido-varejo/[orderId]"');
    expect(rootLayoutSource).toContain('headerShown: true');
    expect(rootLayoutSource).toContain('headerTransparent: true');
    expect(rootLayoutSource).toContain('headerShadowVisible: false');
    expect(rootLayoutSource).toContain('hidesBottomBarWhenPushed: true');
    expect(rootLayoutSource).toContain('headerBackButtonMenuEnabled: false');

    const historySource = readFileSync(
      resolve(process.cwd(), 'src/features/retail-orders/components/RetailOrderHistoryScreen.tsx'),
      'utf8',
    );
    expect(historySource).toContain(
      "router.push({ pathname: '/pedido-varejo/[orderId]', params: { orderId } });",
    );
    expect(historySource).toContain('onPress={() => onOrderPress(order.orderId)}');
  });

  it('keeps the revalidation of an existing history snapshot structurally silent', () => {
    const historySource = readFileSync(
      resolve(process.cwd(), 'src/features/retail-orders/components/RetailOrderHistoryScreen.tsx'),
      'utf8',
    );

    expect(historySource).not.toContain('Atualizando histórico Varejo…');
  });
});
