import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { authService, AuthUserFacingError, mapAuthError } from '@/services/auth';
import type { AuthServiceContract, AuthUser } from '@/services/auth';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGooglePopup: () => Promise<void>;
  signInWithGoogleCredential: (idToken: string, accessToken?: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
  service?: AuthServiceContract;
};

export function AuthProvider({ children, service = authService }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [operationLoading, setOperationLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = service.subscribe(
      (nextUser) => {
        if (!mounted) return;
        setUser(nextUser);
        setStatus(nextUser ? 'authenticated' : 'unauthenticated');
        setError(null);
      },
      (authError) => {
        if (!mounted) return;
        const mapped = mapAuthError(authError, 'session');
        setUser(null);
        setStatus('error');
        setError(mapped.message);
      },
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [service]);

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
      await runAuthentication(() => service.signIn(email, password), 'email');
    },
    [runAuthentication, service],
  );

  const signInWithGooglePopup = useCallback(async () => {
    await runAuthentication(() => service.signInWithGooglePopup(), 'google');
  }, [runAuthentication, service]);

  const signInWithGoogleCredential = useCallback(
    async (idToken: string, accessToken?: string) => {
      await runAuthentication(
        () => service.signInWithGoogleCredential(idToken, accessToken),
        'google',
      );
    },
    [runAuthentication, service],
  );

  const signOut = useCallback(async () => {
    setOperationLoading(true);
    setError(null);
    try {
      await service.signOut();
      setUser(null);
      setStatus('unauthenticated');
    } catch (authError) {
      const mapped =
        authError instanceof AuthUserFacingError ? authError : mapAuthError(authError, 'logout');
      setError(mapped.message);
      setStatus(user ? 'authenticated' : 'error');
      throw mapped;
    } finally {
      setOperationLoading(false);
    }
  }, [service, user]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      error,
      isLoading: status === 'loading' || operationLoading,
      signIn,
      signInWithGooglePopup,
      signInWithGoogleCredential,
      signOut,
      clearError,
    }),
    [
      clearError,
      error,
      operationLoading,
      signIn,
      signInWithGoogleCredential,
      signInWithGooglePopup,
      signOut,
      status,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }
  return context;
}
