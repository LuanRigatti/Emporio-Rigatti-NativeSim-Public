import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, useEffect } from 'react';

import { SessionProvider, useSession } from '@/providers/SessionProvider';
import type { AuthDataSource, AuthUser } from '@/services/auth/types';

jest.mock('@/services/auth/AuthDataSource', () => ({
  authDataSource: {
    getCurrentUser: () => null,
    subscribe: () => () => undefined,
  },
}));

type AuthListener = (user: AuthUser | null) => void;

class DeferredAuthDataSource implements AuthDataSource {
  private currentUser: AuthUser | null = null;
  private listener: AuthListener | null = null;

  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  public subscribe(listener: AuthListener): () => void {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }

  public signIn(): Promise<AuthUser> {
    return Promise.reject(new Error('Not used in test.'));
  }

  public signInWithGoogleNative(): Promise<AuthUser> {
    return Promise.reject(new Error('Not used in test.'));
  }

  public signInWithGooglePopup(): Promise<AuthUser> {
    return Promise.reject(new Error('Not used in test.'));
  }

  public signInWithGoogleCredential(): Promise<AuthUser> {
    return Promise.reject(new Error('Not used in test.'));
  }

  public updateDisplayName(displayName: string): Promise<AuthUser> {
    return Promise.resolve({ ...restoredUser, displayName });
  }

  public signOut(): Promise<void> {
    return Promise.resolve();
  }

  public emit(user: AuthUser | null): void {
    this.currentUser = user;
    this.listener?.(user);
  }
}

const restoredUser: AuthUser = {
  displayName: 'Usuário restaurado',
  email: 'restaurado@example.com',
  id: 'restored-user',
  phoneNumber: null,
  photoUrl: null,
};

describe('SessionProvider startup resolution', () => {
  it('does not expose unauthenticated before Firebase emits its first auth state', async () => {
    const source = new DeferredAuthDataSource();
    let currentStatus: ReturnType<typeof useSession>['status'] | undefined;

    function Harness() {
      const session = useSession();
      currentStatus = session.status;
      return null;
    }

    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(
          SessionProvider,
          {
            dataSource: source,
          },
          createElement(Harness),
        ),
      );
    });

    expect(currentStatus).toBe('loading');

    await act(async () => {
      source.emit(restoredUser);
      await Promise.resolve();
    });

    expect(currentStatus).toBe('authenticated');
    act(() => renderer!.unmount());
  });

  it('resolves unauthenticated only after the initial auth state is emitted', async () => {
    const source = new DeferredAuthDataSource();
    let currentStatus: ReturnType<typeof useSession>['status'] | undefined;

    function Harness() {
      const session = useSession();
      currentStatus = session.status;
      return null;
    }

    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(
          SessionProvider,
          {
            dataSource: source,
          },
          createElement(Harness),
        ),
      );
    });

    expect(currentStatus).toBe('loading');

    await act(async () => {
      source.emit(null);
      await Promise.resolve();
    });

    expect(currentStatus).toBe('unauthenticated');
    act(() => renderer!.unmount());
  });

  it('increments the session version across logout and relogin with the same uid', async () => {
    const source = new DeferredAuthDataSource();
    let sessionVersion = -1;

    function Harness() {
      sessionVersion = useSession().sessionVersion;
      return null;
    }

    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(SessionProvider, { dataSource: source }, createElement(Harness)),
      );
    });

    await act(async () => {
      source.emit(restoredUser);
      await Promise.resolve();
    });
    const firstLoginVersion = sessionVersion;

    await act(async () => {
      source.emit(null);
      await Promise.resolve();
    });
    const logoutVersion = sessionVersion;

    await act(async () => {
      source.emit(restoredUser);
      await Promise.resolve();
    });

    expect(logoutVersion).toBeGreaterThan(firstLoginVersion);
    expect(sessionVersion).toBeGreaterThan(logoutVersion);
    act(() => renderer!.unmount());
  });

  it('passes each session version to session-aware data source bindings', async () => {
    const source = new DeferredAuthDataSource();
    const clientBinding = { setSessionUser: jest.fn() };
    const deliveryBinding = { setSessionUser: jest.fn() };
    const factoryBinding = { setSessionUser: jest.fn() };

    function AppShellBindingHarness() {
      const { sessionVersion, user } = useSession();
      useEffect(() => {
        clientBinding.setSessionUser(user?.id, sessionVersion);
        deliveryBinding.setSessionUser(user?.id, sessionVersion);
        factoryBinding.setSessionUser(user?.id, sessionVersion);
      }, [sessionVersion, user?.id]);
      return null;
    }

    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(
          SessionProvider,
          { dataSource: source },
          createElement(AppShellBindingHarness),
        ),
      );
    });

    await act(async () => {
      source.emit(restoredUser);
      await Promise.resolve();
    });
    const firstLoginVersion = clientBinding.setSessionUser.mock.calls.at(-1)?.[1];

    await act(async () => {
      source.emit(null);
      await Promise.resolve();
    });
    const logoutVersion = clientBinding.setSessionUser.mock.calls.at(-1)?.[1];

    await act(async () => {
      source.emit(restoredUser);
      await Promise.resolve();
    });
    const secondLoginVersion = clientBinding.setSessionUser.mock.calls.at(-1)?.[1];

    expect(firstLoginVersion).toEqual(expect.any(Number));
    expect(logoutVersion).toBeGreaterThan(firstLoginVersion as number);
    expect(secondLoginVersion).toBeGreaterThan(logoutVersion as number);
    expect(deliveryBinding.setSessionUser).toHaveBeenLastCalledWith(
      restoredUser.id,
      secondLoginVersion,
    );
    expect(factoryBinding.setSessionUser).toHaveBeenLastCalledWith(
      restoredUser.id,
      secondLoginVersion,
    );
    act(() => renderer!.unmount());
  });
});
