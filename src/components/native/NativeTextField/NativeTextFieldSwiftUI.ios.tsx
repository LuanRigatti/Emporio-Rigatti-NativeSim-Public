import { Host, TextField, type TextFieldRef, useNativeState } from '@expo/ui/swift-ui';
import { useEffect, useRef } from 'react';
import {
  autocorrectionDisabled,
  keyboardType as keyboardTypeModifier,
} from '@expo/ui/swift-ui/modifiers';

import type { NativeTextFieldProps } from '@/types/native-ui';
import { roundedFont } from '../nativeTypography';

export default function NativeTextFieldSwiftUI({
  keyboardType,
  onChangeText,
  onBlurReady,
  placeholder,
  value,
}: NativeTextFieldProps) {
  const swiftKeyboardType = keyboardType === 'email-address' ? 'email-address' : 'default';
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
    <Host matchContents>
      <TextField
        ref={textFieldRef}
        axis="horizontal"
        modifiers={[
          roundedFont({ textStyle: 'body' }),
          autocorrectionDisabled(true),
          keyboardTypeModifier(swiftKeyboardType),
        ]}
        onTextChange={onChangeText}
        placeholder={placeholder}
        text={text}
      />
    </Host>
  );
}
