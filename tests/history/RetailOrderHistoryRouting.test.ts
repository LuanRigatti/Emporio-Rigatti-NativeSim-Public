/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ComponentType } from 'react';

const mockAppMode = { mode: 'wholesale' as 'wholesale' | 'retail' };

jest.mock('@/features/history', () => ({
  HistoryScreen: () => require('react').createElement('wholesale-history'),
}));
jest.mock('@/features/retail-orders/components/RetailOrderHistoryScreen', () => ({
  RetailOrderHistoryScreen: () => require('react').createElement('retail-order-history'),
}));
jest.mock('@/providers', () => ({
  useAppMode: () => mockAppMode,
}));

const HistoryRoute = require('@/app/(tabs)/historico/index').default as ComponentType;

describe('Retail History AppMode routing', () => {
  function renderRoute(): ReactTestRenderer {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(HistoryRoute));
    });
    return renderer;
  }

  beforeEach(() => {
    mockAppMode.mode = 'wholesale';
  });

  it('keeps the existing wholesale HistoryScreen in wholesale mode', () => {
    const renderer = renderRoute();

    expect(renderer.root.findAll((node) => String(node.type) === 'wholesale-history')).toHaveLength(
      1,
    );
    expect(
      renderer.root.findAll((node) => String(node.type) === 'retail-order-history'),
    ).toHaveLength(0);
  });

  it('renders only the Retail order history branch in retail mode', () => {
    mockAppMode.mode = 'retail';
    const renderer = renderRoute();

    expect(
      renderer.root.findAll((node) => String(node.type) === 'retail-order-history'),
    ).toHaveLength(1);
    expect(renderer.root.findAll((node) => String(node.type) === 'wholesale-history')).toHaveLength(
      0,
    );
  });

  it('switches branches without introducing another tab entry', () => {
    mockAppMode.mode = 'retail';
    const renderer = renderRoute();

    mockAppMode.mode = 'wholesale';
    act(() => renderer.update(createElement(HistoryRoute)));

    expect(renderer.root.findAll((node) => String(node.type) === 'wholesale-history')).toHaveLength(
      1,
    );
    expect(
      renderer.root.findAll((node) => String(node.type) === 'retail-order-history'),
    ).toHaveLength(0);
  });
});
