import { Host, TextField } from '@expo/ui/swift-ui';
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

  return (
    <Host matchContents>
      <TextField
        axis="horizontal"
        defaultValue={value}
        modifiers={[autocorrectionDisabled(true), keyboardTypeModifier(swiftKeyboardType)]}
        onValueChange={onChangeText}
        placeholder={placeholder}
      />
    </Host>
  );
}
