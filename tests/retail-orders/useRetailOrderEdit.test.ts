import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useRetailOrderEdit } from '@/hooks/useRetailOrderEdit';

const mockUpdate = jest.fn();
let mockAuth = {
  sessionVersion: 1,
  user: { id: 'uid-retail' },
};

jest.mock('@/providers', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@/services/retail-orders', () => ({
  retailOrderDataSource: {
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

describe('useRetailOrderEdit', () => {
  beforeEach(() => {
    mockAuth = { sessionVersion: 1, user: { id: 'uid-retail' } };
    mockUpdate.mockReset();
  });

  it('blocks a synchronous double submit for the same order', async () => {
    let resolveUpdate!: () => void;
    mockUpdate.mockReturnValueOnce(new Promise<void>((resolve) => (resolveUpdate = resolve)));
    let current!: ReturnType<typeof useRetailOrderEdit>;
    function Harness() {
      current = useRetailOrderEdit('order-1');
      return null;
    }

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(Harness));
    });

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = current.save({ notes: 'Atualizado' });
      second = current.save({ notes: 'Segundo envio' });
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(await second).toBe(false);
    resolveUpdate();
    await act(async () => {
      await expect(first).resolves.toBe(true);
    });
    expect(mockUpdate).toHaveBeenCalledWith('uid-retail', 'order-1', { notes: 'Atualizado' }, 1);
    act(() => renderer.unmount());
  });

  it('keeps the edit screen retryable after a mutation error', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    let current!: ReturnType<typeof useRetailOrderEdit>;
    function Harness() {
      current = useRetailOrderEdit('order-1');
      return null;
    }

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(Harness));
    });

    await act(async () => {
      await expect(current.save({ notes: 'Atualizado' })).resolves.toBe(false);
    });
    expect(current.error).toBe('offline');

    await act(async () => {
      await expect(current.save({ notes: 'Atualizado novamente' })).resolves.toBe(true);
    });
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    act(() => renderer.unmount());
  });
});
