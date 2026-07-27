import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { mockSessionStore } from './MockSessionStore';

export interface SessionContextValue {
  isAuthenticated: boolean;
  signInWithGoogleMock: () => Promise<void>;
  signOutMock: () => Promise<void>;
  checkAuthentication: () => Promise<boolean>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

type SessionProviderProps = {
  children: ReactNode;
};

export function SessionProvider({ children }: SessionProviderProps) {
  const subscribe = useCallback((listener: () => void) => mockSessionStore.subscribe(listener), []);
  const getSnapshot = useCallback(() => mockSessionStore.isAuthenticated, []);
  const isAuthenticated = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const checkAuthentication = useCallback(() => mockSessionStore.checkAuthentication(), []);
  const signInWithGoogleMock = useCallback(() => mockSessionStore.signInWithGoogleMock(), []);
  const signOutMock = useCallback(() => mockSessionStore.signOutMock(), []);

  const value = useMemo<SessionContextValue>(
    () => ({
      checkAuthentication,
      isAuthenticated,
      signInWithGoogleMock,
      signOutMock,
    }),
    [checkAuthentication, isAuthenticated, signInWithGoogleMock, signOutMock],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession deve ser usado dentro de SessionProvider.');
  }
  return context;
}
