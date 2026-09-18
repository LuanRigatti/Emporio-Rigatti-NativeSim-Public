import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useRetailOrderDetail } from '@/hooks/useRetailOrderDetail';

const mockGetById = jest.fn();
const mockLoadById = jest.fn();
const mockSubscribe = jest.fn();
let mockAuth = {
  sessionVersion: 1,
  status: 'authenticated' as const,
  user: { id: 'uid-retail' },
};
let mockNotify: () => void = () => undefined;

jest.mock('@/providers', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@/services/retail-orders', () => ({
  retailOrderDataSource: {
    getById: (...args: unknown[]) => mockGetById(...args),
    loadById: (...args: unknown[]) => mockLoadById(...args),
    subscribe: (listener: () => void) => {
      mockSubscribe(listener);
      mockNotify = listener;
      return () => undefined;
    },
  },
}));

const cachedOrder = { orderId: 'order-1', clientNameSnapshot: 'Cliente cache' } as never;
const remoteOrder = { orderId: 'order-1', clientNameSnapshot: 'Cliente remoto' } as never;
const localOrder = { orderId: 'order-1', clientNameSnapshot: 'Cliente local atualizado' } as never;

describe('useRetailOrderDetail', () => {
  beforeEach(() => {
    mockAuth = {
      sessionVersion: 1,
      status: 'authenticated',
      user: { id: 'uid-retail' },
    };
    mockGetById.mockReset().mockReturnValue(undefined);
    mockLoadById.mockReset();
    mockSubscribe.mockReset();
    mockNotify = () => undefined;
  });

  it('exposes the cached order immediately and adopts the remote snapshot', async () => {
    mockGetById.mockReturnValue(cachedOrder);
    mockLoadById.mockImplementation(async () => {
      mockGetById.mockReturnValue(remoteOrder);
      mockNotify();
      return remoteOrder;
    });
    let current: ReturnType<typeof useRetailOrderDetail> | undefined;
    function Harness() {
      current = useRetailOrderDetail('order-1');
      return null;
    }

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(Harness));
    });
    expect(current?.order).toBe(cachedOrder);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockLoadById).toHaveBeenCalledWith('order-1', 'uid-retail', 1);
    expect(current?.order).toBe(remoteOrder);
    expect(current?.loading).toBe(false);
    expect(current?.revalidating).toBe(false);
    await act(async () => {
      renderer.unmount();
    });
  });

  it('reports a missing order after remote revalidation removes it', async () => {
    mockLoadById.mockImplementation(async () => {
      mockGetById.mockReturnValue(undefined);
      mockNotify();
      return undefined;
    });
    let current: ReturnType<typeof useRetailOrderDetail> | undefined;
    function Harness() {
      current = useRetailOrderDetail('order-1');
      return null;
    }

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(createElement(Harness));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(current).toMatchObject({ loading: false, notFound: true, order: undefined });
    await act(async () => {
      renderer.unmount();
    });
  });

  it('keeps a cached order visible when remote revalidation fails', async () => {
    mockGetById.mockReturnValue(cachedOrder);
    mockLoadById.mockRejectedValue(new Error('offline'));
    let current: ReturnType<typeof useRetailOrderDetail> | undefined;
    function Harness() {
      current = useRetailOrderDetail('order-1');
      return null;
    }

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(createElement(Harness));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(current).toMatchObject({ error: 'offline', loading: false, order: cachedOrder });
    await act(async () => {
      renderer.unmount();
    });
  });

  it('ends visual revalidation when a newer local snapshot is published', async () => {
    let resolveLoad!: (value: typeof remoteOrder) => void;
    mockGetById.mockReturnValue(cachedOrder);
    mockLoadById.mockImplementation(
      () => new Promise<typeof remoteOrder>((resolve) => (resolveLoad = resolve)),
    );
    let current: ReturnType<typeof useRetailOrderDetail> | undefined;
    function Harness() {
      current = useRetailOrderDetail('order-1');
      return null;
    }

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(Harness));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(current?.revalidating).toBe(true);

    act(() => {
      mockGetById.mockReturnValue(localOrder);
      mockNotify();
    });
    expect(current?.order).toBe(localOrder);
    expect(current?.revalidating).toBe(false);

    await act(async () => {
      resolveLoad(remoteOrder);
      await Promise.resolve();
    });
    expect(current?.order).toBe(localOrder);
    expect(current?.revalidating).toBe(false);
    await act(async () => {
      renderer.unmount();
    });
  });

  it('does not start a deferred load after unmount', async () => {
    function Harness() {
      useRetailOrderDetail('order-1');
      return null;
    }

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(Harness));
      renderer.unmount();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockLoadById).not.toHaveBeenCalled();
  });
});
