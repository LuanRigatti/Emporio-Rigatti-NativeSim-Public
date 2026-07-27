import { useCallback } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useLazyNativeImplementation } from '@/platform/useLazyNativeImplementation';

import NativeGlassIconButtonFallback from './NativeGlassIconButtonFallback';
import type { NativeGlassIconButtonProps } from './NativeGlassIconButton.types';

export default function NativeGlassIconButtonNative(props: NativeGlassIconButtonProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const loadImplementation = useCallback(
    () => import('./NativeGlassIconButtonSwiftUI.ios').then((module) => module.default),
    [],
  );
  const NativeImplementation = useLazyNativeImplementation(canUseExpoUI, loadImplementation);

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeGlassIconButtonFallback {...props} />
  );
}
