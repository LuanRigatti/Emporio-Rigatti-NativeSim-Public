import { SearchBar } from '@/components/premium';

import type { NativeSearchFieldProps } from './NativeSearchField.types';

export default function NativeSearchFieldExpo({
  accessibilityLabel,
  onChangeText,
  placeholder,
  value,
}: NativeSearchFieldProps) {
  return (
    <SearchBar
      accessibilityLabel={accessibilityLabel}
      onChangeText={onChangeText}
      placeholder={placeholder}
      value={value}
    />
  );
}
