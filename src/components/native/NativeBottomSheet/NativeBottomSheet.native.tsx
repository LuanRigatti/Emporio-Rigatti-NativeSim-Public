import { useCallback, useEffect } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useLazyNativeImplementation } from '@/platform/useLazyNativeImplementation';

import NativeBottomSheetFallback from './NativeBottomSheetFallback';
import type { NativeBottomSheetProps } from './NativeBottomSheet.types';

export default function NativeBottomSheetNative(props: NativeBottomSheetProps) {
  const { onImplementationReady } = props;
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const loadImplementation = useCallback(
    () => import('./NativeBottomSheetSwiftUI.ios').then((module) => module.default),
    [],
  );
  const NativeImplementation = useLazyNativeImplementation(canUseExpoUI, loadImplementation);
  const readyImplementation = NativeImplementation ? 'swiftui' : canUseExpoUI ? null : 'fallback';

  useEffect(() => {
    if (!readyImplementation) return;
    onImplementationReady?.(readyImplementation);
  }, [onImplementationReady, readyImplementation]);

  return NativeImplementation ? (
    // The lazy hook resolves this component once; it remains stable after resolution.
    // eslint-disable-next-line react-hooks/static-components
    <NativeImplementation {...props} />
  ) : (
    <NativeBottomSheetFallback {...props} />
  );
}
