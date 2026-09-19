/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement } from 'react';

const mockAuth = { sessionVersion: 1, user: { id: 'uid-retail' } };
const mockOrders: readonly [] = [];
const mockAggregate = jest.fn(() => ({
  deliveryCostRecognized: 0,
  deliveryFeeRecognized: 0,
  margin: 0,
  orderCount: 0,
  paymentFees: 0,
  productCostRecognized: 0,
  productRevenueRecognized: 0,
  profit: 0,
  revenueReceived: 0,
  series: [],
  unitsSold: 0,
  view: 'general',
}));
const mockOrderDataSource = {
  getSnapshot: jest.fn(() => mockOrders),
  hydrateFromCache: jest.fn(async () => true),
  list: jest.fn(() => mockOrders),
  loadHistorical: jest.fn(async () => undefined),
  subscribe: jest.fn(() => () => undefined),
};
const mockPaymentDataSource = {
  getSnapshot: jest.fn(() => null),
  hydrateFromCache: jest.fn(async () => false),
  list: jest.fn(() => []),
  load: jest.fn(async () => undefined),
  subscribe: jest.fn(() => () => undefined),
};

jest.mock('@/providers', () => ({ useAuth: () => mockAuth }));
jest.mock('@/services/retail-finance', () => ({
  buildRetailFinanceCategoryOptions: jest.fn(() => []),
  retailFinanceAggregationService: { aggregate: mockAggregate },
}));
jest.mock('@/services/retail-orders', () => ({
  getRetailOrderHistoryFinancialSignature: jest.fn(() => 'orders-signature'),
  retailOrderDataSource: mockOrderDataSource,
  retailPaymentDataSource: mockPaymentDataSource,
}));

const { useRetailFinance } =
  require('@/hooks/useRetailFinance') as typeof import('@/hooks/useRetailFinance');

describe('useRetailFinance', () => {
  beforeEach(() => {
    mockAggregate.mockClear();
    mockOrderDataSource.getSnapshot.mockClear();
    mockOrderDataSource.hydrateFromCache.mockClear();
    mockOrderDataSource.list.mockClear();
    mockOrderDataSource.loadHistorical.mockClear();
    mockOrderDataSource.subscribe.mockClear();
    mockPaymentDataSource.getSnapshot.mockClear();
    mockPaymentDataSource.hydrateFromCache.mockClear();
    mockPaymentDataSource.list.mockClear();
    mockPaymentDataSource.load.mockClear();
    mockPaymentDataSource.subscribe.mockClear();
  });

  it('hydrates cache before remote history, keeps the summary stable while revalidating, and coalesces loads', async () => {
    let current: ReturnType<typeof useRetailFinance> | undefined;
    function Harness() {
      current = useRetailFinance({ endDate: '2026-09-30', startDate: '2026-09-01' }, 'general');
      return null;
    }

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(createElement(Harness));
      await new Promise((resolve) => setImmediate(resolve));
    });

    expect(current?.summary).not.toBeNull();
    expect(mockOrderDataSource.hydrateFromCache).toHaveBeenCalledTimes(1);
    expect(mockOrderDataSource.loadHistorical).toHaveBeenCalledTimes(1);
    expect(mockPaymentDataSource.load).not.toHaveBeenCalled();
    expect(mockAggregate).toHaveBeenCalled();

    await act(async () => {
      renderer.update(createElement(Harness));
      await new Promise((resolve) => setImmediate(resolve));
    });

    expect(mockOrderDataSource.loadHistorical).toHaveBeenCalledTimes(1);
    await act(async () => renderer.unmount());
  });
});
