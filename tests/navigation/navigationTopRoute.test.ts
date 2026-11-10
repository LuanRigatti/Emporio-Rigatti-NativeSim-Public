import { getNavigationTopRoute } from '@/utils/navigation/navigationTopRoute';

describe('getNavigationTopRoute', () => {
  it('returns the active route name from the navigation state', () => {
    const navigation = {
      getState: () => ({
        index: 1,
        routes: [{ name: 'home' }, { name: 'registrar-entrega/clientes' }],
      }),
    };

    expect(getNavigationTopRoute(navigation as never)).toBe('registrar-entrega/clientes');
  });

  it('returns undefined when navigation state is unavailable or malformed', () => {
    expect(getNavigationTopRoute({ getState: () => undefined } as never)).toBeUndefined();
    expect(
      getNavigationTopRoute({ getState: () => ({ routes: 'invalid' }) } as never),
    ).toBeUndefined();
    expect(
      getNavigationTopRoute({
        getState: () => {
          throw new Error('navigation unavailable');
        },
      } as never),
    ).toBeUndefined();
  });
});
