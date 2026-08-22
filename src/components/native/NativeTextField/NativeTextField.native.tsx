import type { ComponentType } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useTestMode } from '@/hooks/useTestMode';
import { maskNumericInput } from '@/utils/presentation/testModeValues';

import NativeTextFieldExpo from './NativeTextField.expo';
import type { NativeTextFieldProps } from './NativeTextField.types';

export default function NativeTextFieldNative(props: NativeTextFieldProps) {
  const { enabled: testModeEnabled } = useTestMode();
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const NativeImplementation = canUseExpoUI
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./NativeTextFieldSwiftUI.ios').default as ComponentType<NativeTextFieldProps>)
    : null;

  const isNumericField = ['decimal-pad', 'number-pad', 'numeric', 'phone-pad'].includes(
    props.keyboardType ?? '',
  );
  const protectedProps: NativeTextFieldProps = {
    ...props,
    disabled: props.disabled || testModeEnabled,
    onChangeText: testModeEnabled ? () => undefined : props.onChangeText,
    value: isNumericField ? maskNumericInput(props.value, testModeEnabled) ?? '' : props.value,
  };

  return NativeImplementation ? (
    <NativeImplementation {...protectedProps} />
  ) : (
    <NativeTextFieldExpo {...protectedProps} />
  );
}
