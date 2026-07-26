import { Host, TextField } from '@expo/ui/swift-ui';

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
        autocorrection={false}
        defaultValue={value}
        keyboardType={swiftKeyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
      />
    </Host>
  );
}
