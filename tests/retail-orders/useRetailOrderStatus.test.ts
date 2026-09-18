import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useRetailOrderStatus, type RetailOrderStatusState } from '@/hooks/useRetailOrderStatus';

const mockUpdateStatus = jest.fn();
let mockAuth = {
  sessionVersion: 4,
  user: { id: 'uid-retail' },
};

jest.mock('@/providers', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@/services/retail-orders', () => ({
  retailOrderDataSource: {
    updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  },
}));

function Harness({ onRender }: { onRender: (state: RetailOrderStatusState) => void }) {
  onRender(useRetailOrderStatus('order-1'));
  return null;
}

describe('useRetailOrderStatus', () => {
  let renderer: ReactTestRenderer | undefined;
  let state: RetailOrderStatusState | undefined;

  beforeEach(() => {
    mockUpdateStatus.mockReset();
    mockAuth = { sessionVersion: 4, user: { id: 'uid-retail' } };
    renderer = undefined;
    state = undefined;
  });

  afterEach(() => {
    if (renderer) act(() => renderer?.unmount());
  });

  it('passes the current session and blocks a synchronous double submit', async () => {
    let resolveMutation!: () => void;
    const mutation = new Promise<void>((resolve) => {
      resolveMutation = resolve;
    });
    mockUpdateStatus.mockReturnValueOnce(mutation);

    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (next) => (state = next) }));
    });

    act(() => {
      void state?.complete();
      void state?.complete();
    });

    expect(mockUpdateStatus).toHaveBeenCalledTimes(1);
    expect(mockUpdateStatus).toHaveBeenCalledWith('uid-retail', 'order-1', 'completed', 4);
    expect(state?.pending).toBe(true);

    resolveMutation();
    await act(async () => {
      await mutation;
    });

    expect(state?.pending).toBe(false);
    expect(state?.error).toBeUndefined();
  });

  it('keeps the error visible and allows a retry', async () => {
    mockUpdateStatus
      .mockRejectedValueOnce(new Error('Falha temporária'))
      .mockResolvedValueOnce(undefined);

    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (next) => (state = next) }));
    });

    await act(async () => {
      await state?.cancel();
    });
    expect(state?.error).toBe('Falha temporária');
    expect(mockUpdateStatus).toHaveBeenCalledWith('uid-retail', 'order-1', 'cancelled', 4);

    await act(async () => {
      await state?.cancel();
    });
    expect(mockUpdateStatus).toHaveBeenCalledTimes(2);
    expect(state?.error).toBeUndefined();
  });
});
