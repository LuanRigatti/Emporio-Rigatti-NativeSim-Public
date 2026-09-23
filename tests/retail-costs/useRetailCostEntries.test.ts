/* eslint-disable @typescript-eslint/no-require-imports */
import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import type { RetailCostEntry } from '@/types/data';

let mockSessionVersion = 1;
let mockUserId = 'uid-a';
let mockSnapshot: readonly RetailCostEntry[] | null = null;
let mockSnapshotsByScope: ReadonlyMap<string, readonly RetailCostEntry[]> | undefined;
let observedEntries: ReturnType<typeof useRetailCostEntries> | undefined;
const mockListeners = new Set<() => void>();
const mockLoad = jest.fn<Promise<void>, [string, string | undefined, number | undefined]>();

function publish(): void {
  mockListeners.forEach((listener) => listener());
}

jest.mock('@/providers', () => ({
  useAuth: () => ({
    sessionVersion: mockSessionVersion,
    status: 'authenticated',
    user: { id: mockUserId },
  }),
}));

jest.mock('@/services/retail-costs', () => ({
  retailCostEntryDataSource: {
    create: jest.fn(),
    getSnapshot: () =>
      mockSnapshotsByScope?.get(`${mockUserId}:${mockSessionVersion}`) ?? mockSnapshot,
    list: () =>
      mockSnapshotsByScope?.get(`${mockUserId}:${mockSessionVersion}`) ?? mockSnapshot ?? [],
    load: mockLoad,
    subscribe: (listener: () => void) => {
      mockListeners.add(listener);
      return () => mockListeners.delete(listener);
    },
    updateEffectiveDate: jest.fn(),
  },
}));

// The hook must be loaded after its data source mock.
const { useRetailCostEntries } =
  require('@/hooks/useRetailCostEntries') as typeof import('@/hooks/useRetailCostEntries');

const cachedEntry: RetailCostEntry = {
  createdAt: { nanoseconds: 0, seconds: 1 } as RetailCostEntry['createdAt'],
  effectiveDate: '2026-09-20',
  entryId: 'cached-entry',
  normalizedUnitCost: 10,
  purchaseTotalCost: 10,
  purchasedQuantity: 1,
  unit: 'un',
};

function Probe() {
  const entries = useRetailCostEntries('cost-1');
  useEffect(() => {
    observedEntries = entries;
  }, [entries]);
  return null;
}

describe('useRetailCostEntries stale-while-revalidate', () => {
  beforeEach(() => {
    mockListeners.clear();
    mockSessionVersion = 1;
    mockUserId = 'uid-a';
    mockSnapshot = null;
    mockSnapshotsByScope = undefined;
    observedEntries = undefined;
    mockLoad.mockReset().mockResolvedValue(undefined);
  });

  function renderProbe(): ReactTestRenderer {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(Probe));
    });
    return renderer;
  }

  it('renders an in-memory snapshot immediately and revalidates in the background', async () => {
    let resolveRemote!: () => void;
    mockSnapshot = [cachedEntry];
    mockLoad.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveRemote = resolve;
        }),
    );
    renderProbe();

    expect(observedEntries).toMatchObject({ entries: [cachedEntry], loading: false });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockLoad).toHaveBeenCalledWith('cost-1', 'uid-a', 1);

    const refreshedEntry = { ...cachedEntry, normalizedUnitCost: 12 };
    await act(async () => {
      mockSnapshot = [refreshedEntry];
      publish();
      resolveRemote();
      await Promise.resolve();
    });

    expect(observedEntries).toMatchObject({ entries: [refreshedEntry], loading: false });
  });

  it('unblocks the UI as soon as an AsyncStorage hydration publishes a snapshot', async () => {
    let resolveRemote!: () => void;
    mockLoad.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveRemote = resolve;
        }),
    );
    renderProbe();

    expect(observedEntries).toMatchObject({ entries: [], loading: true });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      mockSnapshot = [cachedEntry];
      publish();
      await Promise.resolve();
    });
    expect(observedEntries).toMatchObject({ entries: [cachedEntry], loading: false });

    await act(async () => {
      resolveRemote();
      await Promise.resolve();
    });
  });

  it('preserves a valid snapshot when the background revalidation fails', async () => {
    mockSnapshot = [cachedEntry];
    mockLoad.mockRejectedValueOnce(new Error('Rede indisponível'));
    renderProbe();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(observedEntries).toMatchObject({ entries: [cachedEntry], loading: false });
    expect(observedEntries?.error).toBeUndefined();
  });

  it('keeps loading and exposes an error when no local snapshot exists', async () => {
    mockLoad.mockRejectedValueOnce(new Error('Rede indisponível'));
    renderProbe();

    expect(observedEntries).toMatchObject({ entries: [], loading: true });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(observedEntries).toMatchObject({
      entries: [],
      loading: false,
      error: 'Rede indisponível',
    });
  });

  it('does not expose a previous session snapshot after the auth scope changes', async () => {
    mockSnapshotsByScope = new Map<string, readonly RetailCostEntry[]>([
      ['uid-a:1', [cachedEntry]],
      ['uid-b:2', []],
    ]);
    renderProbe();
    expect(observedEntries?.entries).toEqual([cachedEntry]);

    mockUserId = 'uid-b';
    mockSessionVersion = 2;
    await act(async () => {
      publish();
      await Promise.resolve();
    });

    expect(observedEntries).toMatchObject({ entries: [], loading: false });
  });
});
