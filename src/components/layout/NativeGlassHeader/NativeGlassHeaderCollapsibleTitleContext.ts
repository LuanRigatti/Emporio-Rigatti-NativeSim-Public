import { createContext } from 'react';
import type { ReactNode } from 'react';
import type { SharedValue } from 'react-native-reanimated';

export type NativeGlassHeaderCollapsibleTitleContextValue = {
  compactTitle: ReactNode;
  compactTitleActive: boolean;
  reduceMotionEnabled: boolean;
  scrollY: SharedValue<number>;
};

export const NativeGlassHeaderCollapsibleTitleContext =
  createContext<NativeGlassHeaderCollapsibleTitleContextValue | null>(null);
