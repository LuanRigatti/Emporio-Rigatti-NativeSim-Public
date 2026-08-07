import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement } from 'react';

import { useClients } from '@/hooks/useClients';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
  },
}));

jest.mock('@/providers', () => ({
  useAuth: () => ({ status: 'authenticated', user: undefined }),
}));

describe('useClients', () => {
  it('reuses client references across renders when the source data is unchanged', async () => {
    let current: ReturnType<typeof useClients> | undefined;

    function Harness() {
      current = useClients();
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const firstResult = current;
    expect(firstResult).toBeDefined();
    if (!firstResult) throw new Error('Resultado inicial ausente.');

    await act(async () => {
      renderer?.update(createElement(Harness));
    });

    expect(current?.clients).toBe(firstResult.clients);
    expect(current?.clients[0]).toBe(firstResult.clients[0]);
    if (!renderer) throw new Error('Renderer não foi criado.');
    await act(async () => {
      renderer?.unmount();
    });
  });
});
