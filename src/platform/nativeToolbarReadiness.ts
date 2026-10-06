import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type { AppMode } from '@/types/appMode';

type HomeToolbarReadyEvent = {
  composition: AppMode;
};

type NativeToolbarReadinessModule = {
  addListener: (
    eventName: 'onHomeToolbarReady',
    listener: (event: HomeToolbarReadyEvent) => void,
  ) => { remove: () => void };
  beginHomeToolbarReadiness: (composition: AppMode) => void;
  logSplashHide?: (composition: AppMode) => void;
  setExpectedHomeToolbarComposition: (composition: AppMode) => void;
};

const nativeModule =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<NativeToolbarReadinessModule>('NativeToolbarReadiness')
    : null;

export function setExpectedHomeToolbarComposition(composition: AppMode): void {
  nativeModule?.setExpectedHomeToolbarComposition(composition);
}

export function waitForHomeToolbarReadiness(composition: AppMode): Promise<void> {
  if (!nativeModule) return Promise.resolve();

  return new Promise((resolve) => {
    nativeModule.beginHomeToolbarReadiness(composition);
    const subscription = nativeModule.addListener('onHomeToolbarReady', (event) => {
      if (event.composition !== composition) return;
      subscription.remove();
      resolve();
    });
  });
}

export function logHomeToolbarSplashHide(composition: AppMode): void {
  nativeModule?.logSplashHide?.(composition);
}
