import { useCallback } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useLazyNativeImplementation } from '@/platform/useLazyNativeImplementation';

import NativeBottomSheetFallback from './NativeBottomSheetFallback';
import type { NativeBottomSheetProps } from './NativeBottomSheet.types';

export default function NativeBottomSheetNative(props: NativeBottomSheetProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const loadImplementation = useCallback(
    () => import('./NativeBottomSheetSwiftUI.ios').then((module) => module.default),
    [],
  );
  const NativeImplementation = useLazyNativeImplementation(canUseExpoUI, loadImplementation);

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeBottomSheetFallback {...props} />
  );
}
