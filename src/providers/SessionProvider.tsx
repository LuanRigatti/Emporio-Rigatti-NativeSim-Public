import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { authDataSource } from '@/services/auth/AuthDataSource';
import { AuthUserFacingError, mapAuthError } from '@/services/auth/AuthErrorMapper';
import type { AuthDataSource, AuthUser } from '@/services/auth/types';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface SessionContextValue {
  user: AuthUser | null;
  status: SessionStatus;
  error: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogleNative: () => Promise<void>;
  signInWithGooglePopup: () => Promise<void>;
  signInWithGoogleCredential: (idToken: string, accessToken?: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  signInWithGoogleMock: () => Promise<void>;
  signOutMock: () => Promise<void>;
  checkAuthentication: () => Promise<boolean>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

type SessionProviderProps = {
  children: ReactNode;
  dataSource?: AuthDataSource;
};

export function SessionProvider({ children, dataSource = authDataSource }: SessionProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(() => dataSource.getCurrentUser());
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [operationLoading, setOperationLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = dataSource.subscribe(
      (nextUser) => {
        if (!mounted) return;
        setUser(nextUser);
        setStatus(nextUser ? 'authenticated' : 'unauthenticated');
        setError(null);
      },
      (authError) => {
        if (!mounted) return;
        setUser(null);
        setStatus('error');
        setError(mapAuthError(authError, 'session').message);
      },
    );

    void (dataSource.restore ? dataSource.restore() : Promise.resolve())
      .then(() => {
        if (!mounted) return;
        const restoredUser = dataSource.getCurrentUser();
        setUser(restoredUser);
        setStatus(restoredUser ? 'authenticated' : 'unauthenticated');
      })
      .catch((authError) => {
        if (!mounted) return;
        setUser(null);
        setStatus('error');
        setError(mapAuthError(authError, 'session').message);
      });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [dataSource]);

  const runAuthentication = useCallback(
    async (operation: () => Promise<AuthUser>, operationType: 'email' | 'google') => {
      setOperationLoading(true);
      setError(null);
      try {
        const nextUser = await operation();
        setUser(nextUser);
        setStatus('authenticated');
      } catch (authError) {
        const mapped =
          authError instanceof AuthUserFacingError
            ? authError
            : mapAuthError(authError, operationType);
        setUser(null);
        setStatus('unauthenticated');
        setError(mapped.message);
        throw mapped;
      } finally {
        setOperationLoading(false);
      }
    },
    [],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      await runAuthentication(() => dataSource.signIn(email, password), 'email');
    },
    [dataSource, runAuthentication],
  );

  const signInWithGooglePopup = useCallback(async () => {
    await runAuthentication(() => dataSource.signInWithGooglePopup(), 'google');
  }, [dataSource, runAuthentication]);

  const signInWithGoogleNative = useCallback(async () => {
    await runAuthentication(() => dataSource.signInWithGoogleNative(), 'google');
  }, [dataSource, runAuthentication]);

  const signInWithGoogleCredential = useCallback(
    async (idToken: string, accessToken?: string) => {
      await runAuthentication(
        () => dataSource.signInWithGoogleCredential(idToken, accessToken),
        'google',
      );
    },
    [dataSource, runAuthentication],
  );

  const signOut = useCallback(async () => {
    setOperationLoading(true);
    setError(null);
    try {
      await dataSource.signOut();
      setUser(null);
      setStatus('unauthenticated');
    } catch (authError) {
      setError(mapAuthError(authError, 'logout').message);
      setStatus(user ? 'authenticated' : 'error');
      throw authError;
    } finally {
      setOperationLoading(false);
    }
  }, [dataSource, user]);

  const clearError = useCallback(() => setError(null), []);
  const signInWithGoogleMock = useCallback(() => signInWithGooglePopup(), [signInWithGooglePopup]);
  const signOutMock = useCallback(() => signOut(), [signOut]);
  const checkAuthentication = useCallback(async () => {
    if (dataSource.restore) await dataSource.restore();
    return Boolean(dataSource.getCurrentUser());
  }, [dataSource]);

  const value = useMemo<SessionContextValue>(
    () => ({
      checkAuthentication,
      clearError,
      error,
      isAuthenticated: Boolean(user),
      isLoading: status === 'loading' || operationLoading,
      signIn,
      signInWithGoogleNative,
      signInWithGoogleCredential,
      signInWithGoogleMock,
      signInWithGooglePopup,
      signOut,
      signOutMock,
      status,
      user,
    }),
    [
      checkAuthentication,
      clearError,
      error,
      operationLoading,
      signIn,
      signInWithGoogleNative,
      signInWithGoogleCredential,
      signInWithGoogleMock,
      signInWithGooglePopup,
      signOut,
      signOutMock,
      status,
      user,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession deve ser usado dentro de SessionProvider.');
  return context;
}
