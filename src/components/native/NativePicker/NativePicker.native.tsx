import { useCallback } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useLazyNativeImplementation } from '@/platform/useLazyNativeImplementation';

import NativePickerExpo from './NativePicker.expo';
import type { NativePickerProps } from './NativePicker.types';

export default function NativePickerNative(props: NativePickerProps) {
  const canUseExpoUI = getNativeCapabilities().canUseNativePicker;
  const loadImplementation = useCallback(
    () => import('./NativePickerSwiftUI.ios').then((module) => module.default),
    [],
  );
  const NativeImplementation = useLazyNativeImplementation(canUseExpoUI, loadImplementation);

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativePickerExpo {...props} />
  );
}
