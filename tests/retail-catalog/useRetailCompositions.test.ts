/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, useEffect, type ReactNode } from 'react';

import type { RetailCompositionVersion } from '@/types/data';

const mockLoad = jest.fn<Promise<void>, [string, string, number]>();
const mockCreateVersion = jest.fn();
const mockSnapshots = new Map<string, readonly RetailCompositionVersion[]>();
const mockListeners = new Set<() => void>();

let mockAuth = {
  sessionVersion: 7,
  status: 'authenticated' as const,
  user: { id: 'user-1' },
};

jest.mock('@/providers', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@/services/retail-costs', () => ({
  retailCompositionDataSource: {
    createVersion: mockCreateVersion,
    getSnapshot: (productId?: string) =>
      productId ? (mockSnapshots.get(productId) ?? null) : null,
    list: (productId: string) => [...(mockSnapshots.get(productId) ?? [])],
    load: mockLoad,
    subscribe: (listener: () => void) => {
      mockListeners.add(listener);
      return () => mockListeners.delete(listener);
    },
  },
}));

const { useRetailCompositions } =
  require('@/hooks/useRetailCompositions') as typeof import('@/hooks/useRetailCompositions');

function version(id: string): RetailCompositionVersion {
  return {
    active: true,
    components: [],
    compositionVersionId: id,
    createdAt: null,
    effectiveFrom: '2026-09-20',
    productId: id.replace('version-', 'product-'),
  } as unknown as RetailCompositionVersion;
}

const mockCapture = jest.fn<void, [ReturnType<typeof useRetailCompositions>]>();

function Harness({ productId }: { productId: string }): ReactNode {
  const state = useRetailCompositions(productId);
  useEffect(() => {
    mockCapture(state);
  }, [state]);
  return null;
}

function currentState(): ReturnType<typeof useRetailCompositions> | undefined {
  return mockCapture.mock.calls.at(-1)?.[0];
}

describe('useRetailCompositions loading contract', () => {
  let renderer: ReactTestRenderer | undefined;
  let resolveLoad: (() => void) | undefined;

  beforeEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
    mockCapture.mockReset();
    mockSnapshots.clear();
    mockListeners.clear();
    mockCreateVersion.mockReset();
    mockLoad.mockReset();
    mockAuth = {
      sessionVersion: 7,
      status: 'authenticated',
      user: { id: 'user-1' },
    };
    resolveLoad = undefined;
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
  });

  it('does not report structural loading when a warm snapshot already exists', async () => {
    const warmVersion = version('version-a');
    mockSnapshots.set('product-a', [warmVersion]);
    mockLoad.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLoad = resolve;
        }),
    );

    act(() => {
      renderer = create(createElement(Harness, { productId: 'product-a' }));
    });

    expect(currentState()?.loading).toBe(false);
    expect(currentState()?.versions).toEqual([warmVersion]);

    await act(async () => {
      await new Promise<void>((resolve) => setImmediate(resolve));
    });

    expect(mockLoad).toHaveBeenCalledWith('product-a', 'user-1', 7);
    expect(currentState()?.loading).toBe(false);
    expect(currentState()?.versions).toEqual([warmVersion]);

    await act(async () => {
      resolveLoad?.();
      await new Promise<void>((resolve) => setImmediate(resolve));
    });
  });

  it('keeps structural loading for a cold product without a snapshot', async () => {
    mockLoad.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLoad = resolve;
        }),
    );

    act(() => {
      renderer = create(createElement(Harness, { productId: 'product-a' }));
    });

    expect(currentState()?.loading).toBe(true);

    await act(async () => {
      await new Promise<void>((resolve) => setImmediate(resolve));
    });

    expect(currentState()?.loading).toBe(true);

    await act(async () => {
      resolveLoad?.();
      await new Promise<void>((resolve) => setImmediate(resolve));
    });
  });

  it('keeps a warm snapshot visible while revalidation is pending', async () => {
    const warmVersion = version('version-a');
    mockSnapshots.set('product-a', [warmVersion]);
    mockLoad.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLoad = resolve;
        }),
    );

    act(() => {
      renderer = create(createElement(Harness, { productId: 'product-a' }));
    });
    await act(async () => {
      await new Promise<void>((resolve) => setImmediate(resolve));
    });

    expect(currentState()?.loading).toBe(false);
    expect(currentState()?.versions).toEqual([warmVersion]);

    act(() => mockListeners.forEach((listener) => listener()));
    expect(currentState()?.versions).toEqual([warmVersion]);
    expect(currentState()?.loading).toBe(false);

    await act(async () => {
      resolveLoad?.();
      await new Promise<void>((resolve) => setImmediate(resolve));
    });
  });

  it('reads only the snapshot for the requested product and forwards the session guard', async () => {
    const versionA = version('version-a');
    const versionB = version('version-b');
    mockSnapshots.set('product-a', [versionA]);
    mockSnapshots.set('product-b', [versionB]);
    mockLoad.mockResolvedValue(undefined);

    act(() => {
      renderer = create(createElement(Harness, { productId: 'product-a' }));
    });
    expect(currentState()?.versions).toEqual([versionA]);

    await act(async () => {
      await new Promise<void>((resolve) => setImmediate(resolve));
    });

    act(() => {
      renderer?.update(createElement(Harness, { productId: 'product-b' }));
    });
    expect(currentState()?.versions).toEqual([versionB]);

    await act(async () => {
      await new Promise<void>((resolve) => setImmediate(resolve));
    });

    expect(mockLoad).toHaveBeenLastCalledWith('product-b', 'user-1', 7);
  });
});
