import { SearchBar } from '@/components/premium';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import type { NativeSearchFieldProps } from './NativeSearchField.types';

export default function NativeSearchFieldExpo({
  accessibilityLabel,
  autoFocus,
  blurRequestKey,
  focusRequestKey,
  hapticOnFocus = true,
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
      autoFocus={autoFocus}
      blurRequestKey={blurRequestKey}
      focusRequestKey={focusRequestKey}
      onChangeText={onChangeText}
      onBlur={() => {
        onFocusChange?.(false);
      }}
      onFocus={() => {
        if (hapticOnFocus) triggerLightImpactHaptic();
        onFocusChange?.(true);
      }}
      onPressHelp={onPressHelp}
      onSubmitEditing={({ nativeEvent }) => onSubmit?.(nativeEvent.text)}
      placeholder={placeholder}
      value={value}
    />
  );
}
