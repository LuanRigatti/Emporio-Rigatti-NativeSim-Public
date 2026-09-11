import { useCallback } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useLazyNativeImplementation } from '@/platform/useLazyNativeImplementation';

import NativeSheetExpo from './NativeSheet.expo';
import type { NativeSheetProps } from './NativeSheet.types';

export default function NativeSheetNative(props: NativeSheetProps) {
  const canUseExpoUI = getNativeCapabilities().canUseNativeSheet;
  const loadImplementation = useCallback(
    () => import('./NativeSheetSwiftUI.ios').then((module) => module.default),
    [],
  );
  const NativeImplementation = useLazyNativeImplementation(canUseExpoUI, loadImplementation);

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeSheetExpo {...props} />
  );
}
