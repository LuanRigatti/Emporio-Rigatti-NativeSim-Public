import { useFocusEffect } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from 'react';

type RootToolbarRenderer = () => ReactNode;

type RootToolbarEntry = {
  id: string;
  renderRightItems: RootToolbarRenderer;
};

type RootToolbarContextValue = {
  rightItems: ReactNode;
  register: (id: string, renderRightItems: RootToolbarRenderer) => void;
  setActive: (id: string) => void;
  unregister: (id: string) => void;
};

const RootToolbarContext = createContext<RootToolbarContextValue | null>(null);

export function RootToolbarProvider({ children }: PropsWithChildren) {
  const [entries, setEntries] = useState<RootToolbarEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const register = useCallback((id: string, renderRightItems: RootToolbarRenderer) => {
    setEntries((current) => {
      const existingIndex = current.findIndex((entry) => entry.id === id);
      if (existingIndex === -1) {
        return [...current, { id, renderRightItems }];
      }

      if (current[existingIndex]?.renderRightItems === renderRightItems) return current;

      const next = [...current];
      next[existingIndex] = { id, renderRightItems };
      return next;
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const setActive = useCallback((id: string) => {
    setActiveId((current) => (current === id ? current : id));
  }, []);

  const activeRenderer = entries.find((entry) => entry.id === activeId)?.renderRightItems;
  const rightItems = useMemo(() => activeRenderer?.() ?? null, [activeRenderer]);
  const value = useMemo(
    () => ({ rightItems, register, setActive, unregister }),
    [register, rightItems, setActive, unregister],
  );

  return <RootToolbarContext.Provider value={value}>{children}</RootToolbarContext.Provider>;
}

export function useRootToolbar(id: string, renderRightItems: RootToolbarRenderer): void {
  const context = useContext(RootToolbarContext);
  if (!context) {
    throw new Error('useRootToolbar must be used inside RootToolbarProvider.');
  }

  const { register, setActive, unregister } = context;

  useEffect(() => {
    register(id, renderRightItems);
    return () => unregister(id);
  }, [id, register, renderRightItems, unregister]);

  useFocusEffect(
    useCallback(() => {
      setActive(id);
    }, [id, setActive]),
  );
}

export function useRootToolbarItems(): ReactNode {
  const context = useContext(RootToolbarContext);
  if (!context) {
    throw new Error('useRootToolbarItems must be used inside RootToolbarProvider.');
  }

  return context.rightItems;
}

export function renderEmptyRootToolbarItems(): null {
  return null;
}
