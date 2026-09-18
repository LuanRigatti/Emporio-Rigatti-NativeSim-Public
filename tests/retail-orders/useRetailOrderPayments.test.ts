import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useRetailOrderPayments } from '@/hooks/useRetailOrderPayments';
import type { RetailPayment } from '@/types/data';

const mockLoad = jest.fn<Promise<void>, [string, string, number]>();
const mockVoidPayment = jest.fn<Promise<void>, [string | undefined, string, string, number]>();
const mockGetSnapshot = jest.fn();
const mockList = jest.fn();
let mockSnapshot: readonly RetailPayment[] | null = [];
let mockAuth = {
  sessionVersion: 4,
  status: 'authenticated',
  user: { id: 'uid-retail' },
};

jest.mock('@/providers', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@/services/retail-orders', () => ({
  retailPaymentDataSource: {
    getSnapshot: () => mockGetSnapshot(),
    list: () => mockList(),
    load: (orderId: string, userId: string, sessionVersion: number) =>
      mockLoad(orderId, userId, sessionVersion),
    register: jest.fn(),
    subscribe: () => () => undefined,
    voidPayment: (
      userId: string | undefined,
      orderId: string,
      paymentId: string,
      sessionVersion: number,
    ) => mockVoidPayment(userId, orderId, paymentId, sessionVersion),
  },
}));

function Harness({
  onRender,
}: {
  onRender: (state: ReturnType<typeof useRetailOrderPayments>) => void;
}) {
  onRender(useRetailOrderPayments('order-1'));
  return null;
}

describe('useRetailOrderPayments void mutation', () => {
  let renderer: ReactTestRenderer | undefined;
  let state: ReturnType<typeof useRetailOrderPayments> | undefined;

  beforeEach(() => {
    mockSnapshot = [];
    mockAuth = {
      sessionVersion: 4,
      status: 'authenticated',
      user: { id: 'uid-retail' },
    };
    mockGetSnapshot.mockReset().mockImplementation(() => mockSnapshot);
    mockList.mockReset().mockImplementation(() => mockSnapshot ?? []);
    mockLoad.mockReset().mockResolvedValue(undefined);
    mockVoidPayment.mockReset();
    renderer = undefined;
    state = undefined;
  });

  afterEach(() => {
    if (renderer) act(() => renderer?.unmount());
  });

  it('passes the current session and blocks a synchronous double void', async () => {
    let resolveMutation!: () => void;
    const mutation = new Promise<void>((resolve) => {
      resolveMutation = resolve;
    });
    mockVoidPayment.mockReturnValueOnce(mutation);

    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (next) => (state = next) }));
    });

    act(() => {
      void state?.voidPayment('payment-1');
      void state?.voidPayment('payment-1');
    });

    expect(mockVoidPayment).toHaveBeenCalledTimes(1);
    expect(mockVoidPayment).toHaveBeenCalledWith('uid-retail', 'order-1', 'payment-1', 4);
    expect(state?.voidingPaymentId).toBe('payment-1');

    resolveMutation();
    await act(async () => {
      await mutation;
    });

    expect(state?.voidingPaymentId).toBeUndefined();
    expect(state?.mutationError).toBeUndefined();
  });

  it('keeps the mutation error visible and allows a retry', async () => {
    mockVoidPayment
      .mockRejectedValueOnce(new Error('Falha temporária'))
      .mockResolvedValueOnce(undefined);

    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (next) => (state = next) }));
    });

    await act(async () => {
      await state?.voidPayment('payment-1');
    });
    expect(state?.mutationError).toBe('Falha temporária');

    await act(async () => {
      await state?.voidPayment('payment-1');
    });
    expect(mockVoidPayment).toHaveBeenCalledTimes(2);
    expect(state?.mutationError).toBeUndefined();
  });
});
