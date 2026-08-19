import React, { createContext, useContext, useState } from 'react';

export type GlassMorphState = 'circle' | 'capsule' | null;

type CrossScreenGlassMorphContextType = {
  morphState: GlassMorphState;
  setMorphState: (state: GlassMorphState) => void;
};

const CrossScreenGlassMorphContext = createContext<CrossScreenGlassMorphContextType | null>(null);

export function CrossScreenGlassMorphProvider({ children }: { children: React.ReactNode }) {
  const [morphState, setMorphState] = useState<GlassMorphState>(null);

  return (
    <CrossScreenGlassMorphContext.Provider
      value={{
        morphState,
        setMorphState,
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
