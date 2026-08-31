import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement } from 'react';

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
    renderer!.unmount();
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
    renderer!.unmount();
  });
});
