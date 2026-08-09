import { SearchBar } from '@/components/premium';

import type { NativeSearchFieldProps } from './NativeSearchField.types';

export default function NativeSearchFieldExpo({
  accessibilityLabel,
  onChangeText,
  onFocusChange,
  onSubmit,
  placeholder,
  value,
}: NativeSearchFieldProps) {
  return (
    <SearchBar
      accessibilityLabel={accessibilityLabel}
      onChangeText={onChangeText}
      onBlur={() => onFocusChange?.(false)}
      onFocus={() => onFocusChange?.(true)}
      onSubmitEditing={() => onSubmit?.()}
      placeholder={placeholder}
      value={value}
    />
  );
}
