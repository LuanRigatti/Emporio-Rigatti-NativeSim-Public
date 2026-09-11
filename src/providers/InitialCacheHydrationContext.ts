import { createContext, useContext } from 'react';

export const InitialCacheHydrationContext = createContext(false);

export function useInitialCacheHydration(): boolean {
  return useContext(InitialCacheHydrationContext);
}
