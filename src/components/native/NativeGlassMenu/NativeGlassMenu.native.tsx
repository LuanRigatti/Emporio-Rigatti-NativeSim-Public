import { useCallback, useEffect } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useLazyNativeImplementation } from '@/platform/useLazyNativeImplementation';

import NativeGlassMenuFallback from './NativeGlassMenuFallback';
import type { NativeGlassMenuProps } from './NativeGlassMenu.types';

export default function NativeGlassMenuNative(props: NativeGlassMenuProps) {
  const { onImplementationReady } = props;
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const loadImplementation = useCallback(
    () => import('./NativeGlassMenuSwiftUI.ios').then((module) => module.default),
    [],
  );
  const NativeImplementation = useLazyNativeImplementation(canUseExpoUI, loadImplementation);

  useEffect(() => {
    if (NativeImplementation) {
      onImplementationReady?.();
    }
  }, [NativeImplementation, onImplementationReady]);

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeGlassMenuFallback {...props} />
  );
}
