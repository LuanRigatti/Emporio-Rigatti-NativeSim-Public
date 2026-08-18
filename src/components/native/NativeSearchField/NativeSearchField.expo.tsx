import { SearchBar } from '@/components/premium';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import type { NativeSearchFieldProps } from './NativeSearchField.types';

export default function NativeSearchFieldExpo({
  accessibilityLabel,
  onChangeText,
  onFocusChange,
  onPressHelp,
  onSubmit,
  placeholder,
  value,
}: NativeSearchFieldProps) {
  return (
    <SearchBar
      accessibilityLabel={accessibilityLabel}
      onChangeText={onChangeText}
      onBlur={() => onFocusChange?.(false)}
      onFocus={() => {
        triggerLightImpactHaptic();
        onFocusChange?.(true);
      }}
      onPressHelp={onPressHelp}
      onSubmitEditing={({ nativeEvent }) => onSubmit?.(nativeEvent.text)}
      placeholder={placeholder}
      value={value}
    />
  );
}
