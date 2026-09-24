import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { authDataSource } from '@/services/auth/AuthDataSource';
import { AuthUserFacingError, mapAuthError } from '@/services/auth/AuthErrorMapper';
import type { AuthDataSource, AuthUser } from '@/services/auth/types';
import { setRouteTrackingSession } from '@/services/routes/RouteTrackingSessionBridge';

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
  updateDisplayName: (displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  signInWithGoogleMock: () => Promise<void>;
  signOutMock: () => Promise<void>;
  checkAuthentication: () => Promise<boolean>;
  sessionVersion: number;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

type SessionProviderProps = {
  children?: ReactNode;
  dataSource?: AuthDataSource;
};

export function SessionProvider({ children, dataSource = authDataSource }: SessionProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(() => dataSource.getCurrentUser());
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [operationLoading, setOperationLoading] = useState(false);
  const sessionUidRef = useRef<string | null>(user?.id ?? null);
  const sessionVersionRef = useRef(0);
  const [sessionVersion, setSessionVersion] = useState(0);

  const commitSession = useCallback((nextUser: AuthUser | null, nextStatus: SessionStatus) => {
    const nextUid = nextUser?.id ?? null;
    if (sessionUidRef.current !== nextUid) {
      sessionUidRef.current = nextUid;
      sessionVersionRef.current += 1;
      setSessionVersion(sessionVersionRef.current);
    }
    setRouteTrackingSession(nextUid, sessionVersionRef.current);
    setUser(nextUser);
    setStatus(nextStatus);
  }, []);

  useEffect(() => {
    let mounted = true;
    let initializationResolved = false;
    let initialAuthError: string | null = null;
    let pendingUser: AuthUser | null = null;
    let resolveFirstAuthState: () => void = () => undefined;
    const firstAuthState = new Promise<void>((resolve) => {
      resolveFirstAuthState = resolve;
    });

    const unsubscribe = dataSource.subscribe(
      (nextUser) => {
        if (!mounted) return;
        pendingUser = nextUser;
        resolveFirstAuthState();
        if (!initializationResolved) return;
        commitSession(nextUser, nextUser ? 'authenticated' : 'unauthenticated');
        setError(null);
      },
      (authError) => {
        if (!mounted) return;
        const message = mapAuthError(authError, 'session').message;
        if (!initializationResolved) {
          initialAuthError = message;
          resolveFirstAuthState();
          return;
        }
        commitSession(null, 'error');
        setError(message);
      },
    );

    const restorePromise = dataSource.restore
      ? Promise.resolve().then(() => dataSource.restore?.())
      : firstAuthState;

    void restorePromise
      .then(() => {
        if (!mounted) return;
        initializationResolved = true;
        if (initialAuthError) {
          commitSession(null, 'error');
          setError(initialAuthError);
          return;
        }
        const restoredUser = dataSource.restore ? dataSource.getCurrentUser() : pendingUser;
        commitSession(restoredUser, restoredUser ? 'authenticated' : 'unauthenticated');
      })
      .catch((authError) => {
        if (!mounted) return;
        commitSession(null, 'error');
        setError(mapAuthError(authError, 'session').message);
      });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [commitSession, dataSource]);

  const runAuthentication = useCallback(
    async (operation: () => Promise<AuthUser>, operationType: 'email' | 'google') => {
      setOperationLoading(true);
      setError(null);
      try {
        const nextUser = await operation();
        commitSession(nextUser, 'authenticated');
      } catch (authError) {
        const mapped =
          authError instanceof AuthUserFacingError
            ? authError
            : mapAuthError(authError, operationType);
        commitSession(null, 'unauthenticated');
        setError(mapped.message);
        throw mapped;
      } finally {
        setOperationLoading(false);
      }
    },
    [commitSession],
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

  const updateDisplayName = useCallback(
    async (displayName: string) => {
      const normalizedDisplayName = displayName.trim();
      if (!normalizedDisplayName) {
        const validationError = new AuthUserFacingError(
          'unknown',
          'Informe um nome para continuar.',
        );
        setError(validationError.message);
        throw validationError;
      }

      setOperationLoading(true);
      setError(null);
      try {
        const nextUser = await dataSource.updateDisplayName(normalizedDisplayName);
        setUser(nextUser);
      } catch (authError) {
        const mapped =
          authError instanceof AuthUserFacingError ? authError : mapAuthError(authError, 'profile');
        setError(mapped.message);
        throw mapped;
      } finally {
        setOperationLoading(false);
      }
    },
    [dataSource],
  );

  const signOut = useCallback(async () => {
    setOperationLoading(true);
    setError(null);
    try {
      await dataSource.signOut();
      commitSession(null, 'unauthenticated');
    } catch (authError) {
      setError(mapAuthError(authError, 'logout').message);
      setStatus(user ? 'authenticated' : 'error');
      throw authError;
    } finally {
      setOperationLoading(false);
    }
  }, [commitSession, dataSource, user]);

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
      updateDisplayName,
      signOut,
      signOutMock,
      sessionVersion,
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
      updateDisplayName,
      signOut,
      signOutMock,
      sessionVersion,
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
