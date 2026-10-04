import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { HomeProfileSheet } from './HomeProfileSheet';

type HomeProfileSheetContextValue = {
  openProfileSheet: () => void;
};

const HomeProfileSheetContext = createContext<HomeProfileSheetContextValue | null>(null);

export function HomeProfileSheetProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const openProfileSheet = useCallback(() => setVisible(true), []);
  const contextValue = useMemo(() => ({ openProfileSheet }), [openProfileSheet]);

  return (
    <HomeProfileSheetContext.Provider value={contextValue}>
      {children}
      <HomeProfileSheet onVisibleChange={setVisible} visible={visible} />
    </HomeProfileSheetContext.Provider>
  );
}

export function useHomeProfileSheet() {
  const context = useContext(HomeProfileSheetContext);

  if (!context) {
    throw new Error('useHomeProfileSheet must be used within HomeProfileSheetProvider');
  }

  return context;
}
