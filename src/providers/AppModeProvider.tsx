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

import { useSession } from './SessionProvider';
import { appModeStorage } from '@/services/preferences/AppModeStorage';
import { DEFAULT_APP_MODE, type AppMode } from '@/types/appMode';

export interface AppModeContextValue {
  mode: AppMode;
  isReady: boolean;
  setMode: (mode: AppMode) => void;
}

export const AppModeContext = createContext<AppModeContextValue | null>(null);

export function AppModeProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const uid = user?.id?.trim() || null;
  const cachedMode = uid ? appModeStorage.getCached(uid) : undefined;
  const [loadedPreference, setLoadedPreference] = useState<{
    uid: string;
    mode: AppMode;
  } | null>(null);
  const loadGenerationRef = useRef(0);
  const loadedMode = uid && loadedPreference?.uid === uid ? loadedPreference.mode : undefined;
  const mode = loadedMode ?? cachedMode ?? DEFAULT_APP_MODE;
  const isReady = !uid || loadedMode !== undefined || cachedMode !== undefined;

  useEffect(() => {
    const requestGeneration = ++loadGenerationRef.current;
    let active = true;

    if (!uid)
      return () => {
        active = false;
      };

    void appModeStorage.load(uid).then((nextMode) => {
      if (!active || requestGeneration !== loadGenerationRef.current) return;
      setLoadedPreference({ uid, mode: nextMode });
    });

    return () => {
      active = false;
    };
  }, [uid]);

  const setMode = useCallback(
    (nextMode: AppMode) => {
      if (!uid) return;
      loadGenerationRef.current += 1;
      setLoadedPreference({ uid, mode: nextMode });
      void appModeStorage.save(uid, nextMode).catch(() => undefined);
    },
    [uid],
  );

  const value = useMemo(() => ({ isReady, mode, setMode }), [isReady, mode, setMode]);

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode(): AppModeContextValue {
  const context = useContext(AppModeContext);
  if (!context) throw new Error('useAppMode deve ser usado dentro de AppModeProvider.');
  return context;
}
