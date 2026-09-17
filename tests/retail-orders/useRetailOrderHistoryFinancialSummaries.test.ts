import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import {
  getRetailOrderHistoryFinancialCandidateOrders,
  useRetailOrderHistoryFinancialSummaries,
} from '@/hooks/useRetailOrderHistory';
import type { RetailOrder, RetailOrderFinancialSummary } from '@/types/data';

type SummaryState = ReturnType<typeof useRetailOrderHistoryFinancialSummaries>;
type FinancialResult =
  { status: 'ready'; summary: RetailOrderFinancialSummary } | { status: 'error'; message: string };

const mockLoadForOrders = jest.fn();
const mockClear = jest.fn();
const mockPrimeFromCache = jest.fn();
const mockGetCachedSummary = jest.fn();
const mockSummaryListeners = new Set<() => void>();
let mockAuth = {
  sessionVersion: 1,
  status: 'authenticated' as const,
  user: { id: 'uid-retail' },
};
const pendingLoads: {
  orders: readonly RetailOrder[];
  options?: {
    onCachedSummary?: (
      orderId: string,
      summary: RetailOrderFinancialSummary,
      revalidating: boolean,
    ) => void;
    revalidate?: boolean;
  };
  resolve: (results: ReadonlyMap<string, FinancialResult>) => void;
}[] = [];

jest.mock('@/providers', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@/services/retail-orders', () => ({
  getRetailOrderHistoryFinancialSignature: (order: RetailOrder) =>
    [
      order.orderId,
      order.orderDate,
      order.status,
      order.subtotalProducts,
      order.discount,
      order.deliveryFee,
      order.deliveryCost,
    ].join('|'),
  retailOrderDataSource: {},
  retailOrderHistoryFinancialSummaryService: {
    clear: () => mockClear(),
    subscribe: (listener: () => void) => {
      mockSummaryListeners.add(listener);
      return () => mockSummaryListeners.delete(listener);
    },
    getCachedSummary: (order: RetailOrder, userId: string, sessionVersion?: number) =>
      mockGetCachedSummary(order, userId, sessionVersion),
    primeFromCache: (orders: readonly RetailOrder[], userId: string, sessionVersion?: number) =>
      mockPrimeFromCache(orders, userId, sessionVersion),
    loadForOrders: (
      orders: readonly RetailOrder[],
      _userId: string,
      _sessionVersion?: number,
      options?: { revalidate?: boolean },
    ) => {
      let resolve!: (results: ReadonlyMap<string, FinancialResult>) => void;
      const promise = new Promise<ReadonlyMap<string, FinancialResult>>((nextResolve) => {
        resolve = nextResolve;
      });
      pendingLoads.push({ options, orders, resolve });
      mockLoadForOrders(orders, _userId, _sessionVersion, options);
      return promise;
    },
  },
}));

function order(id: string, overrides: Partial<RetailOrder> = {}): RetailOrder {
  return {
    orderDate: '2026-09-15',
    orderId: id,
    status: 'created',
    subtotalProducts: 100,
    discount: 0,
    deliveryFee: 10,
    deliveryCost: 5,
    ...overrides,
  } as RetailOrder;
}

function summary(overrides: Partial<RetailOrderFinancialSummary> = {}) {
  return {
    financialStatus: 'unpaid',
    outstandingAmount: 110,
    paidAmount: 0,
    totalCharged: 110,
    ...overrides,
  } as RetailOrderFinancialSummary;
}

function readyResults(orders: readonly RetailOrder[], value = summary()) {
  return new Map(
    orders.map((item) => [item.orderId, { status: 'ready' as const, summary: value }]),
  );
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function Harness({
  candidateOrders,
  onRender,
  orders,
  refreshKey = 0,
}: {
  candidateOrders?: readonly RetailOrder[];
  onRender: (value: SummaryState) => void;
  orders: readonly RetailOrder[];
  refreshKey?: number;
}) {
  onRender(useRetailOrderHistoryFinancialSummaries(orders, refreshKey, candidateOrders));
  return null;
}

describe('useRetailOrderHistoryFinancialSummaries', () => {
  beforeEach(() => {
    mockAuth = {
      sessionVersion: 1,
      status: 'authenticated',
      user: { id: 'uid-retail' },
    };
    mockLoadForOrders.mockReset();
    mockClear.mockReset();
    mockPrimeFromCache.mockReset();
    mockGetCachedSummary.mockReset();
    mockSummaryListeners.clear();
    pendingLoads.length = 0;
  });

  it('builds a deduplicated cache-prewarm candidate union for day, week and month', () => {
    const target = order('order-target');
    const orders = [
      target,
      target,
      order('order-week', { orderDate: '2026-09-20' }),
      order('order-month', { orderDate: '2026-09-30' }),
      order('order-outside', { orderDate: '2026-10-01' }),
    ];

    expect(
      getRetailOrderHistoryFinancialCandidateOrders(orders, '2026-09-15').map(
        (item) => item.orderId,
      ),
    ).toEqual(['order-target', 'order-week', 'order-month']);
  });

  it('starts cache-only prewarm for candidate orders without changing visible loading flow', async () => {
    let current: SummaryState = {};
    let renderer!: ReactTestRenderer;
    const visibleOrder = order('order-visible');
    const candidateOrders = [visibleOrder, order('order-candidate')];

    await act(async () => {
      renderer = create(
        createElement(Harness, {
          candidateOrders,
          onRender: (value) => (current = value),
          orders: [visibleOrder],
        }),
      );
      await settle();
    });

    expect(mockPrimeFromCache).toHaveBeenCalledWith(candidateOrders, 'uid-retail', 1);
    expect(current['order-visible']).toEqual({ status: 'loading' });
    act(() => renderer.unmount());
  });

  it('renders a summary already prewarmed in memory before the visible load resolves', async () => {
    let current: SummaryState = {};
    let renderer!: ReactTestRenderer;
    const target = order('order-prewarmed');
    mockGetCachedSummary.mockReturnValue(summary({ paidAmount: 30 }));

    await act(async () => {
      renderer = create(
        createElement(Harness, { onRender: (value) => (current = value), orders: [target] }),
      );
      await settle();
    });

    expect(current['order-prewarmed']).toMatchObject({
      status: 'ready',
      summary: { paidAmount: 30 },
    });
    act(() => renderer.unmount());
  });

  it('preserves ready summaries when the array reference changes but its financial identity does not', async () => {
    let current: SummaryState = {};
    let renderer!: ReactTestRenderer;
    const firstOrders = [order('order-a')];

    await act(async () => {
      renderer = create(
        createElement(Harness, { onRender: (value) => (current = value), orders: firstOrders }),
      );
      await settle();
    });
    expect(pendingLoads).toHaveLength(1);

    await act(async () => {
      pendingLoads[0]?.resolve(readyResults(firstOrders));
      await settle();
    });
    expect(current['order-a']).toMatchObject({ status: 'ready' });

    await act(async () => {
      renderer.update(
        createElement(Harness, {
          onRender: (value) => (current = value),
          orders: [order('order-a')],
        }),
      );
      await settle();
    });

    expect(current['order-a']).toMatchObject({ status: 'ready' });
    expect(pendingLoads).toHaveLength(1);
    expect(mockClear).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  it('loads only a new order while keeping existing summaries ready', async () => {
    let current: SummaryState = {};
    let renderer!: ReactTestRenderer;
    const firstOrder = order('order-a');

    await act(async () => {
      renderer = create(
        createElement(Harness, { onRender: (value) => (current = value), orders: [firstOrder] }),
      );
      await settle();
    });
    await act(async () => {
      pendingLoads[0]?.resolve(readyResults([firstOrder]));
      await settle();
    });

    const secondOrder = order('order-b');
    await act(async () => {
      renderer.update(
        createElement(Harness, {
          onRender: (value) => (current = value),
          orders: [order('order-a'), secondOrder],
        }),
      );
      await settle();
    });

    expect(current['order-a']).toMatchObject({ status: 'ready' });
    expect(current['order-b']).toEqual({ status: 'loading' });
    expect(pendingLoads).toHaveLength(2);

    await act(async () => {
      pendingLoads[1]?.resolve(readyResults([order('order-a'), secondOrder]));
      await settle();
    });
    expect(current['order-b']).toMatchObject({ status: 'ready' });
    act(() => renderer.unmount());
  });

  it('revalidates ready summaries without clearing the cache or showing structural loading', async () => {
    let current: SummaryState = {};
    let renderer!: ReactTestRenderer;
    const target = order('order-a');

    await act(async () => {
      renderer = create(
        createElement(Harness, { onRender: (value) => (current = value), orders: [target] }),
      );
      await settle();
    });
    await act(async () => {
      pendingLoads[0]?.resolve(readyResults([target]));
      await settle();
    });

    await act(async () => {
      renderer.update(
        createElement(Harness, {
          onRender: (value) => (current = value),
          orders: [order('order-a')],
          refreshKey: 1,
        }),
      );
      await settle();
    });

    expect(current['order-a']).toMatchObject({ status: 'ready', revalidating: true });
    expect(pendingLoads[1]?.options).toMatchObject({ revalidate: true });
    expect(mockClear).not.toHaveBeenCalled();

    await act(async () => {
      pendingLoads[1]?.resolve(
        readyResults(
          [target],
          summary({ financialStatus: 'paid', outstandingAmount: 0, paidAmount: 110 }),
        ),
      );
      await settle();
    });

    expect(current['order-a']).toMatchObject({
      status: 'ready',
      summary: { financialStatus: 'paid', outstandingAmount: 0, paidAmount: 110 },
    });
    act(() => renderer.unmount());
  });

  it('publishes a cache-first summary before the remote result settles', async () => {
    let current: SummaryState = {};
    let renderer!: ReactTestRenderer;
    const target = order('order-a');

    await act(async () => {
      renderer = create(
        createElement(Harness, { onRender: (value) => (current = value), orders: [target] }),
      );
      await settle();
    });
    expect(pendingLoads).toHaveLength(1);

    await act(async () => {
      pendingLoads[0]?.options?.onCachedSummary?.('order-a', summary({ paidAmount: 30 }), true);
      await settle();
    });

    expect(current['order-a']).toMatchObject({
      revalidating: true,
      status: 'ready',
      summary: { paidAmount: 30 },
    });

    await act(async () => {
      pendingLoads[0]?.resolve(readyResults([target]));
      await settle();
    });
    expect(current['order-a']).toMatchObject({ status: 'ready' });
    act(() => renderer.unmount());
  });

  it('publishes a point-updated summary without returning the card to loading', async () => {
    let current: SummaryState = {};
    let renderer!: ReactTestRenderer;
    const target = order('order-a');

    await act(async () => {
      renderer = create(
        createElement(Harness, { onRender: (value) => (current = value), orders: [target] }),
      );
      await settle();
    });
    await act(async () => {
      pendingLoads[0]?.resolve(readyResults([target]));
      await settle();
    });

    mockGetCachedSummary.mockReturnValue(
      summary({ financialStatus: 'partially_paid', outstandingAmount: 60, paidAmount: 50 }),
    );
    await act(async () => {
      mockSummaryListeners.forEach((listener) => listener());
      await settle();
    });

    expect(current['order-a']).toMatchObject({
      status: 'ready',
      summary: { financialStatus: 'partially_paid', outstandingAmount: 60, paidAmount: 50 },
    });
    act(() => renderer.unmount());
  });

  it('keeps the last ready summary when a background revalidation fails', async () => {
    let current: SummaryState = {};
    let renderer!: ReactTestRenderer;
    const target = order('order-a');

    await act(async () => {
      renderer = create(
        createElement(Harness, { onRender: (value) => (current = value), orders: [target] }),
      );
      await settle();
    });
    await act(async () => {
      pendingLoads[0]?.resolve(readyResults([target]));
      await settle();
    });

    await act(async () => {
      renderer.update(
        createElement(Harness, {
          onRender: (value) => (current = value),
          orders: [order('order-a')],
          refreshKey: 1,
        }),
      );
      await settle();
    });
    await act(async () => {
      pendingLoads[1]?.resolve(
        new Map([['order-a', { status: 'error' as const, message: 'offline' }]]),
      );
      await settle();
    });

    expect(current['order-a']).toMatchObject({
      status: 'ready',
      revalidationError: 'offline',
      summary: { paidAmount: 0 },
    });
    act(() => renderer.unmount());
  });

  it('does not reuse a previous user session summary', async () => {
    let current: SummaryState = {};
    let renderer!: ReactTestRenderer;
    const target = order('order-a');

    await act(async () => {
      renderer = create(
        createElement(Harness, { onRender: (value) => (current = value), orders: [target] }),
      );
      await settle();
    });
    await act(async () => {
      pendingLoads[0]?.resolve(readyResults([target]));
      await settle();
    });

    mockAuth = {
      sessionVersion: 2,
      status: 'authenticated',
      user: { id: 'uid-other' },
    };
    await act(async () => {
      renderer.update(
        createElement(Harness, {
          onRender: (value) => (current = value),
          orders: [order('order-a')],
        }),
      );
      await settle();
    });

    expect(current['order-a']).toEqual({ status: 'loading' });
    expect(pendingLoads).toHaveLength(2);
    act(() => renderer.unmount());
  });
});
