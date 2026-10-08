/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ComponentType } from 'react';

const mockAppMode = {
  mode: 'wholesale' as 'wholesale' | 'retail',
  isReady: true,
  setMode: jest.fn(),
};
const mockParams: { mode?: string | string[] } = {};
const mockRouter = {
  setParams: jest.fn((params: { mode?: undefined | string }) => {
    mockParams.mode = params.mode;
  }),
};

jest.mock('@/features/history', () => ({
  HistoryScreen: () => require('react').createElement('wholesale-history'),
}));
jest.mock('@/features/retail-orders/components/RetailOrderHistoryScreen', () => ({
  RetailOrderHistoryScreen: () => require('react').createElement('retail-order-history'),
}));
jest.mock('@/providers', () => ({
  useAppMode: () => mockAppMode,
}));
jest.mock('expo-router', () => ({
  router: mockRouter,
  useLocalSearchParams: () => mockParams,
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
    mockAppMode.isReady = true;
    mockAppMode.setMode.mockReset().mockImplementation((mode: 'wholesale' | 'retail') => {
      mockAppMode.mode = mode;
    });
    mockParams.mode = undefined;
    mockRouter.setParams.mockClear();
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

  it('applies the explicit wholesale mode deep link and consumes its query parameter', () => {
    mockAppMode.mode = 'retail';
    mockParams.mode = 'wholesale';
    const renderer = renderRoute();

    expect(
      renderer.root.findAll((node) => String(node.type) === 'retail-order-history'),
    ).toHaveLength(0);
    expect(mockAppMode.setMode).toHaveBeenCalledWith('wholesale');

    act(() => renderer.update(createElement(HistoryRoute)));

    expect(renderer.root.findAll((node) => String(node.type) === 'wholesale-history')).toHaveLength(
      1,
    );
    expect(mockRouter.setParams).toHaveBeenCalledWith({ mode: undefined });
    expect(mockParams.mode).toBeUndefined();
  });

  it('waits for the saved mode preference before applying the wholesale deep link', () => {
    mockAppMode.mode = 'retail';
    mockAppMode.isReady = false;
    mockParams.mode = 'wholesale';
    const renderer = renderRoute();

    expect(mockAppMode.setMode).not.toHaveBeenCalled();
    expect(mockRouter.setParams).not.toHaveBeenCalled();
    expect(
      renderer.root.findAll((node) => String(node.type) === 'retail-order-history'),
    ).toHaveLength(0);

    mockAppMode.isReady = true;
    act(() => renderer.update(createElement(HistoryRoute)));

    expect(mockAppMode.setMode).toHaveBeenCalledWith('wholesale');
    act(() => renderer.update(createElement(HistoryRoute)));
    expect(renderer.root.findAll((node) => String(node.type) === 'wholesale-history')).toHaveLength(
      1,
    );
    expect(mockParams.mode).toBeUndefined();
  });

  it('does not reapply the consumed wholesale intent after the user switches to retail', () => {
    mockAppMode.mode = 'retail';
    mockParams.mode = 'wholesale';
    const renderer = renderRoute();
    act(() => renderer.update(createElement(HistoryRoute)));

    expect(mockAppMode.mode).toBe('wholesale');
    expect(mockParams.mode).toBeUndefined();

    mockAppMode.mode = 'retail';
    act(() => renderer.update(createElement(HistoryRoute)));

    expect(
      renderer.root.findAll((node) => String(node.type) === 'retail-order-history'),
    ).toHaveLength(1);
    expect(mockAppMode.setMode).toHaveBeenCalledTimes(1);
  });
});
