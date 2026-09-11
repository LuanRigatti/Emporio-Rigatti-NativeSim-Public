import type { ComponentType } from 'react';

import NativeStartupSplashView from './NativeStartupSplashView';

export type NativeStartupSplashAnimationCompleteEvent = {
  nativeEvent: {
    completed: boolean;
  };
};

export type NativeStartupSplashReadyEvent = {
  nativeEvent: {
    ready: boolean;
  };
};

export type NativeStartupSplashProps = {
  colorScheme: 'light' | 'dark';
  startReveal: boolean;
  reduceMotion?: boolean;
  onReady?: (event: NativeStartupSplashReadyEvent) => void;
  onAnimationComplete?: (event: NativeStartupSplashAnimationCompleteEvent) => void;
};

export const NativeStartupSplash =
  NativeStartupSplashView as ComponentType<NativeStartupSplashProps>;
