import { Host, TextField, useNativeState } from '@expo/ui/swift-ui';
import { useEffect } from 'react';
import {
  autocorrectionDisabled,
  keyboardType as keyboardTypeModifier,
} from '@expo/ui/swift-ui/modifiers';

import type { NativeTextFieldProps } from '@/types/native-ui';

export default function NativeTextFieldSwiftUI({
  keyboardType,
  onChangeText,
  placeholder,
  value,
}: NativeTextFieldProps) {
  const swiftKeyboardType = keyboardType === 'email-address' ? 'email-address' : 'default';
  const text = useNativeState(value);

  useEffect(() => {
    text.set(value);
  }, [text, value]);

  return (
    <Host matchContents>
      <TextField
        axis="horizontal"
        modifiers={[autocorrectionDisabled(true), keyboardTypeModifier(swiftKeyboardType)]}
        onTextChange={onChangeText}
        placeholder={placeholder}
        text={text}
      />
    </Host>
  );
}
