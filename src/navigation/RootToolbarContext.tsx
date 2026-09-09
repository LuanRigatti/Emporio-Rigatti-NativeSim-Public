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
  renderLeftItems: RootToolbarRenderer;
  renderRightItems: RootToolbarRenderer;
};

type RootToolbarContextValue = {
  leftItems: ReactNode;
  rightItems: ReactNode;
  register: (
    id: string,
    renderRightItems: RootToolbarRenderer,
    renderLeftItems: RootToolbarRenderer,
  ) => void;
  setActive: (id: string) => void;
  unregister: (id: string) => void;
};

const RootToolbarContext = createContext<RootToolbarContextValue | null>(null);

export function RootToolbarProvider({ children }: PropsWithChildren) {
  const [entries, setEntries] = useState<RootToolbarEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const register = useCallback(
    (id: string, renderRightItems: RootToolbarRenderer, renderLeftItems: RootToolbarRenderer) => {
      setEntries((current) => {
        const existingIndex = current.findIndex((entry) => entry.id === id);
        if (existingIndex === -1) {
          return [...current, { id, renderLeftItems, renderRightItems }];
        }

        if (
          current[existingIndex]?.renderLeftItems === renderLeftItems &&
          current[existingIndex]?.renderRightItems === renderRightItems
        ) {
          return current;
        }

        const next = [...current];
        next[existingIndex] = { id, renderLeftItems, renderRightItems };
        return next;
      });
    },
    [],
  );

  const unregister = useCallback((id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const setActive = useCallback((id: string) => {
    setActiveId((current) => (current === id ? current : id));
  }, []);

  const activeEntry = entries.find((entry) => entry.id === activeId);
  const leftItems = useMemo(() => activeEntry?.renderLeftItems() ?? null, [activeEntry]);
  const rightItems = useMemo(() => activeEntry?.renderRightItems() ?? null, [activeEntry]);
  const value = useMemo(
    () => ({ leftItems, rightItems, register, setActive, unregister }),
    [leftItems, register, rightItems, setActive, unregister],
  );

  return <RootToolbarContext.Provider value={value}>{children}</RootToolbarContext.Provider>;
}

export function useRootToolbar(
  id: string,
  renderRightItems: RootToolbarRenderer,
  renderLeftItems: RootToolbarRenderer = renderEmptyRootToolbarItems,
): void {
  const context = useContext(RootToolbarContext);
  if (!context) {
    throw new Error('useRootToolbar must be used inside RootToolbarProvider.');
  }

  const { register, setActive, unregister } = context;

  useEffect(() => {
    register(id, renderRightItems, renderLeftItems);
    return () => unregister(id);
  }, [id, register, renderLeftItems, renderRightItems, unregister]);

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

export function useRootToolbarLeftItems(): ReactNode {
  const context = useContext(RootToolbarContext);
  if (!context) {
    throw new Error('useRootToolbarLeftItems must be used inside RootToolbarProvider.');
  }

  return context.leftItems;
}

export function renderEmptyRootToolbarItems(): null {
  return null;
}
