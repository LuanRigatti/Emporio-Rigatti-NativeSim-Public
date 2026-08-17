import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

export type GlassMorphTargetConfig = {
  bounds: { x: number; y: number; width: number; height: number };
  shape: 'circle' | 'capsule';
  symbols: string[];
  color?: string;
  size?: number;
};

export type ActiveGlassTransition = {
  morphId: string;
  source: GlassMorphTargetConfig;
  isTarget: boolean;
  direction: 'forward' | 'backward';
};

type CrossScreenGlassMorphContextType = {
  registerTarget: (morphId: string, config: GlassMorphTargetConfig) => void;
  unregisterTarget: (morphId: string) => void;
  startTransition: (morphId: string, onNavigate: () => void) => void;
  startBackTransition: (morphId: string, onNavigateBack: () => void) => void;
  finishTransition: () => void;
  activeTransition: ActiveGlassTransition | null;
  hiddenMorphIds: Set<string>;
};

const CrossScreenGlassMorphContext = createContext<CrossScreenGlassMorphContextType | null>(null);

export function CrossScreenGlassMorphProvider({ children }: { children: React.ReactNode }) {
  const targetsRef = useRef<Map<string, GlassMorphTargetConfig>>(new Map());
  const [activeTransition, setActiveTransition] = useState<ActiveGlassTransition | null>(null);
  const [hiddenMorphIds, setHiddenMorphIds] = useState<Set<string>>(new Set());

  const registerTarget = useCallback((morphId: string, config: GlassMorphTargetConfig) => {
    targetsRef.current.set(morphId, config);
  }, []);

  const unregisterTarget = useCallback((morphId: string) => {
    targetsRef.current.delete(morphId);
  }, []);

  const finishTransition = useCallback(() => {
    setActiveTransition(null);
    setHiddenMorphIds(new Set());
  }, []);

  const startTransition = useCallback((morphId: string, onNavigate: () => void) => {
    const source = targetsRef.current.get(morphId);
    if (!source) {
      onNavigate();
      return;
    }

    setHiddenMorphIds(new Set([morphId]));
    setActiveTransition({
      direction: 'forward',
      isTarget: false,
      morphId,
      source,
    });

    onNavigate();

    requestAnimationFrame(() => {
      setActiveTransition((current) => (current ? { ...current, isTarget: true } : null));
    });
  }, []);

  const startBackTransition = useCallback((morphId: string, onNavigateBack: () => void) => {
    const currentTarget = targetsRef.current.get(morphId);
    if (!currentTarget) {
      onNavigateBack();
      return;
    }

    setHiddenMorphIds(new Set([morphId]));
    setActiveTransition({
      direction: 'backward',
      isTarget: true,
      morphId,
      source: currentTarget,
    });

    onNavigateBack();

    requestAnimationFrame(() => {
      setActiveTransition((current) => (current ? { ...current, isTarget: false } : null));
    });
  }, []);

  return (
    <CrossScreenGlassMorphContext.Provider
      value={{
        activeTransition,
        finishTransition,
        hiddenMorphIds,
        registerTarget,
        startBackTransition,
        startTransition,
        unregisterTarget,
      }}
    >
      {children}
    </CrossScreenGlassMorphContext.Provider>
  );
}

export function useCrossScreenGlassMorph() {
  const context = useContext(CrossScreenGlassMorphContext);
  if (!context) {
    throw new Error('useCrossScreenGlassMorph must be used within CrossScreenGlassMorphProvider');
  }
  return context;
}
