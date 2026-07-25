import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  loadFinancialPrivacy,
  saveFinancialPrivacy,
} from '@/services/privacy/FinancialPrivacyStorage';

export interface FinancialPrivacyContextValue {
  hidden: boolean;
  isReady: boolean;
  setHidden: (hidden: boolean) => void;
  toggleHidden: () => void;
}

export const FinancialPrivacyContext = createContext<FinancialPrivacyContextValue | undefined>(
  undefined,
);

export function FinancialPrivacyProvider({ children }: PropsWithChildren) {
  const [hidden, setHiddenState] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void loadFinancialPrivacy()
      .then((storedValue) => {
        if (mounted) setHiddenState(storedValue);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setIsReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setHidden = useCallback((nextHidden: boolean) => {
    setHiddenState(nextHidden);
    void saveFinancialPrivacy(nextHidden).catch(() => undefined);
  }, []);

  const toggleHidden = useCallback(() => setHidden(!hidden), [hidden, setHidden]);

  const value = useMemo<FinancialPrivacyContextValue>(
    () => ({ hidden, isReady, setHidden, toggleHidden }),
    [hidden, isReady, setHidden, toggleHidden],
  );

  return (
    <FinancialPrivacyContext.Provider value={value}>
      {isReady ? children : null}
    </FinancialPrivacyContext.Provider>
  );
}

export function useFinancialPrivacyContext(): FinancialPrivacyContextValue {
  const context = useContext(FinancialPrivacyContext);
  if (!context) {
    throw new Error('useFinancialPrivacy deve ser usado dentro de FinancialPrivacyProvider.');
  }
  return context;
}
