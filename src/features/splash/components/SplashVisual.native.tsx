import { useCallback } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useLazyNativeImplementation } from '@/platform/useLazyNativeImplementation';

import { SplashFallback } from './SplashFallback';
import type { SplashVisualProps } from './SplashVisual.types';

export default function SplashVisualNative(props: SplashVisualProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const loadImplementation = useCallback(
    () => import('./SplashNativeSwiftUI.ios').then((module) => module.default),
    [],
  );
  const NativeImplementation = useLazyNativeImplementation(canUseExpoUI, loadImplementation);

  return NativeImplementation ? <NativeImplementation {...props} /> : <SplashFallback {...props} />;
}
