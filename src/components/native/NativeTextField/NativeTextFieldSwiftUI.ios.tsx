import { Host, TextField, type TextFieldRef, useNativeState } from '@expo/ui/swift-ui';
import { useEffect, useRef } from 'react';
import {
  autocorrectionDisabled,
  disabled as disabledModifier,
  fixedSize,
  keyboardType as keyboardTypeModifier,
  lineLimit,
} from '@expo/ui/swift-ui/modifiers';

import type { NativeTextFieldProps } from '@/types/native-ui';
import { roundedFont } from '../nativeTypography';

export default function NativeTextFieldSwiftUI({
  keyboardType,
  disabled,
  onChangeText,
  onBlurReady,
  placeholder,
  multiline,
  value,
}: NativeTextFieldProps) {
  const swiftKeyboardType =
    keyboardType === 'email-address'
      ? 'email-address'
      : keyboardType === 'decimal-pad'
        ? 'decimal-pad'
        : 'default';
  const text = useNativeState(value);
  const textFieldRef = useRef<TextFieldRef>(null);

  useEffect(() => {
    text.set(value);
  }, [text, value]);

  useEffect(() => {
    if (!onBlurReady) return;
    onBlurReady(() => {
      void textFieldRef.current?.blur();
    });
  }, [onBlurReady]);

  return (
    <Host
      matchContents={multiline ? { vertical: true } : true}
      style={multiline ? { width: '100%' } : undefined}
    >
      <TextField
        ref={textFieldRef}
        axis={multiline ? 'vertical' : 'horizontal'}
        modifiers={[
          roundedFont({ textStyle: 'body' }),
          autocorrectionDisabled(true),
          ...(disabled ? [disabledModifier(true)] : []),
          ...(multiline ? [lineLimit(), fixedSize({ horizontal: false, vertical: true })] : []),
          keyboardTypeModifier(swiftKeyboardType),
        ]}
        onTextChange={onChangeText}
        placeholder={placeholder}
        text={text}
      />
    </Host>
  );
}
