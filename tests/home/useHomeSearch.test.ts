import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement } from 'react';

import { useHomeSearch } from '@/features/home/hooks/useHomeSearch';
import type { HomeSearchDataSet } from '@/features/home/search/HomeSearchTypes';

let mockAuth: { sessionVersion: number; user: { id: string } | null };
let mockLoad: jest.Mock;

jest.mock('@/providers', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@/features/home/search/HomeSearchDataSource', () => ({
  AppHomeSearchDataSource: jest.fn().mockImplementation(() => ({
    load: (...args: unknown[]) => mockLoad(...args),
  })),
}));

function emptyDataSet(): HomeSearchDataSet {
  return {
    clients: [],
    deliveries: [],
    factoryPurchases: [],
    coverage: [],
    errors: [],
  };
}

function SearchHarness({
  onValue,
}: {
  onValue: (value: ReturnType<typeof useHomeSearch>) => void;
}) {
  onValue(useHomeSearch());
  return null;
}

describe('useHomeSearch - session isolation', () => {
  beforeEach(() => {
    mockAuth = { sessionVersion: 1, user: { id: 'uid-test' } };
    mockLoad = jest.fn();
  });

  it('passes the attached date into the structured search period', async () => {
    mockLoad.mockResolvedValue(emptyDataSet());

    let currentValue: ReturnType<typeof useHomeSearch> | undefined;
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        createElement(SearchHarness, { onValue: (value) => (currentValue = value) }),
      );
    });

    await act(async () => {
      await currentValue!.search('faturamento', { selectedDate: '2026-09-22' });
    });

    expect(mockLoad).toHaveBeenCalledWith(
      expect.objectContaining({ period: { kind: 'date', date: '2026-09-22' } }),
    );
    await act(async () => {
      renderer.unmount();
    });
  });

  it('discards a search response started before a same-uid session change', async () => {
    let resolveOldSearch: (data: HomeSearchDataSet) => void = () => undefined;
    const oldSearch = new Promise<HomeSearchDataSet>((resolve) => {
      resolveOldSearch = resolve;
    });
    mockLoad.mockReturnValueOnce(oldSearch);

    let currentValue: ReturnType<typeof useHomeSearch> | undefined;
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        createElement(SearchHarness, { onValue: (value) => (currentValue = value) }),
      );
      await Promise.resolve();
    });

    let oldSearchPromise: Promise<unknown> | undefined;
    await act(async () => {
      oldSearchPromise = currentValue!.search('01/2099');
      await Promise.resolve();
    });
    expect(mockLoad).toHaveBeenCalledTimes(1);

    mockAuth = { sessionVersion: 2, user: { id: 'uid-test' } };
    await act(async () => {
      renderer.update(createElement(SearchHarness, { onValue: (value) => (currentValue = value) }));
    });

    resolveOldSearch(emptyDataSet());
    await act(async () => {
      await oldSearchPromise;
    });

    expect(currentValue?.response).toBeNull();
    expect(currentValue?.loading).toBe(false);
    await act(async () => {
      renderer.unmount();
    });
  });
});
