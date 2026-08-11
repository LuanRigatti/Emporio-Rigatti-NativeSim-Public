import type { ComponentType } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import NativeTextFieldExpo from './NativeTextField.expo';
import type { NativeTextFieldProps } from './NativeTextField.types';

export default function NativeTextFieldNative(props: NativeTextFieldProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const NativeImplementation = canUseExpoUI
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./NativeTextFieldSwiftUI.ios').default as ComponentType<NativeTextFieldProps>)
    : null;

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeTextFieldExpo {...props} />
  );
}
