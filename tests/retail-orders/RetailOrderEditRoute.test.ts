/* eslint-disable @typescript-eslint/no-require-imports */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement, type ComponentType } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const routeParams: { orderId?: string | string[] } = { orderId: 'order-1' };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => routeParams,
}));

jest.mock('@/features/retail-orders/components/RetailOrderEditScreen', () => ({
  RetailOrderEditScreen: (props: { orderId?: string }) =>
    require('react').createElement('retail-order-edit', props),
}));

const RetailOrderEditRoute = require('@/app/pedido-varejo/[orderId]/editar')
  .default as ComponentType;

describe('RetailOrderEditRoute', () => {
  beforeEach(() => {
    routeParams.orderId = 'order-1';
  });

  it('passes only the normalized orderId to the edit screen', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailOrderEditRoute));
    });

    const editScreen = renderer.root.find((node) => String(node.type) === 'retail-order-edit');
    expect(editScreen.props).toEqual({ orderId: 'order-1' });
  });

  it('registers the edit page in the Root Stack without changing native structure', () => {
    const rootLayoutSource = readFileSync(resolve(process.cwd(), 'src/app/_layout.tsx'), 'utf8');
    expect(rootLayoutSource).toContain('name="pedido-varejo/[orderId]/editar"');
    expect(rootLayoutSource).toContain('hidesBottomBarWhenPushed: true');
    expect(rootLayoutSource).toContain('headerShown: true');
    expect(rootLayoutSource).toContain('headerTransparent: true');
    expect(rootLayoutSource).toContain('headerShadowVisible: false');
  });
});
