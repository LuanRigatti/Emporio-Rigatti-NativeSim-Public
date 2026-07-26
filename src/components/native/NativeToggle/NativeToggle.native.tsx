import { useCallback } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useLazyNativeImplementation } from '@/platform/useLazyNativeImplementation';

import NativeToggleExpo from './NativeToggle.expo';
import type { NativeToggleProps } from './NativeToggle.types';

export default function NativeToggleNative(props: NativeToggleProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const loadImplementation = useCallback(
    () => import('./NativeToggleSwiftUI.ios').then((module) => module.default),
    [],
  );
  const NativeImplementation = useLazyNativeImplementation(canUseExpoUI, loadImplementation);

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeToggleExpo {...props} />
  );
}
