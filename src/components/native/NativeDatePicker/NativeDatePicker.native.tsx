import { useCallback } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useLazyNativeImplementation } from '@/platform/useLazyNativeImplementation';

import NativeDatePickerExpo from './NativeDatePicker.expo';
import type { NativeDatePickerProps } from './NativeDatePicker.types';

export default function NativeDatePickerNative(props: NativeDatePickerProps) {
  const canUseExpoUI = getNativeCapabilities().canUseNativePicker;
  const loadImplementation = useCallback(
    () => import('./NativeDatePickerSwiftUI.ios').then((module) => module.default),
    [],
  );
  const NativeImplementation = useLazyNativeImplementation(canUseExpoUI, loadImplementation);

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeDatePickerExpo {...props} />
  );
}
