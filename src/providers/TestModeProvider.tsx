import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { testModeStorage } from '@/services/preferences/TestModeStorage';

export type TestModeContextValue = {
  enabled: boolean;
  isReady: boolean;
  setEnabled: (enabled: boolean) => void;
};

export const TestModeContext = createContext<TestModeContextValue | null>(null);

export function TestModeProvider({ children }: { children: React.ReactNode }) {
  const cachedValue = testModeStorage.getCached();
  const [enabled, setEnabledState] = useState(cachedValue ?? false);
  const [isReady, setIsReady] = useState(cachedValue !== undefined);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = testModeStorage.subscribe((nextEnabled) => {
      if (!mounted) return;
      setEnabledState(nextEnabled);
      setIsReady(true);
    });

    void testModeStorage.load().then((nextEnabled) => {
      if (!mounted) return;
      setEnabledState(nextEnabled);
      setIsReady(true);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const setEnabled = useCallback((nextEnabled: boolean) => {
    setEnabledState(nextEnabled);
    void testModeStorage.save(nextEnabled);
  }, []);

  const value = useMemo(() => ({ enabled, isReady, setEnabled }), [enabled, isReady, setEnabled]);

  return <TestModeContext.Provider value={value}>{children}</TestModeContext.Provider>;
}

export function useTestMode(): TestModeContextValue {
  const context = useContext(TestModeContext);
  if (!context) throw new Error('useTestMode must be used inside TestModeProvider');
  return context;
}
