import { useCallback } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useLazyNativeImplementation } from '@/platform/useLazyNativeImplementation';

import NativeButtonExpo from './NativeButton.expo';
import type { NativeButtonProps } from './NativeButton.types';

export default function NativeButtonNative(props: NativeButtonProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const loadImplementation = useCallback(
    () => import('./NativeButtonSwiftUI.ios').then((module) => module.default),
    [],
  );
  const NativeImplementation = useLazyNativeImplementation(canUseExpoUI, loadImplementation);

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeButtonExpo {...props} />
  );
}
