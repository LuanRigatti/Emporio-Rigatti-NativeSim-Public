import { useCallback } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useLazyNativeImplementation } from '@/platform/useLazyNativeImplementation';

import NativeTextFieldExpo from './NativeTextField.expo';
import type { NativeTextFieldProps } from './NativeTextField.types';

export default function NativeTextFieldNative(props: NativeTextFieldProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const loadImplementation = useCallback(
    () => import('./NativeTextFieldSwiftUI.ios').then((module) => module.default),
    [],
  );
  const NativeImplementation = useLazyNativeImplementation(canUseExpoUI, loadImplementation);

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeTextFieldExpo {...props} />
  );
}
