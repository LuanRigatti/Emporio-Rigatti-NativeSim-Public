import { useCallback } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useLazyNativeImplementation } from '@/platform/useLazyNativeImplementation';

import NativeGlassActionGroupFallback from './NativeGlassActionGroupFallback';
import type { NativeGlassActionGroupProps } from './NativeGlassActionGroup.types';

export default function NativeGlassActionGroupNative(props: NativeGlassActionGroupProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const loadImplementation = useCallback(
    () => import('./NativeGlassActionGroupSwiftUI.ios').then((module) => module.default),
    [],
  );
  const NativeImplementation = useLazyNativeImplementation(canUseExpoUI, loadImplementation);

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeGlassActionGroupFallback {...props} />
  );
}
