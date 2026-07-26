import { useCallback } from 'react';

import NativeMenuExpo from './NativeMenu.expo';
import type { NativeMenuProps } from './NativeMenu.types';
import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useLazyNativeImplementation } from '@/platform/useLazyNativeImplementation';

export default function NativeMenuNative(props: NativeMenuProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const loadImplementation = useCallback(
    () => import('./NativeMenuSwiftUI.ios').then((module) => module.default),
    [],
  );
  const NativeImplementation = useLazyNativeImplementation(canUseExpoUI, loadImplementation);

  return NativeImplementation ? <NativeImplementation {...props} /> : <NativeMenuExpo {...props} />;
}
