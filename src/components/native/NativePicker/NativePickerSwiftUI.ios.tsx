import { Host, Picker } from '@expo/ui/swift-ui';

import type { NativePickerProps } from '@/types/native-ui';

export default function NativePickerSwiftUI({
  label,
  onSelectedIndexChange,
  options,
  selectedIndex,
}: NativePickerProps) {
  return (
    <Host matchContents>
      <Picker
        label={label}
        onOptionSelected={({ nativeEvent }) => onSelectedIndexChange(nativeEvent.index)}
        options={[...options]}
        selectedIndex={selectedIndex}
        variant="menu"
      />
    </Host>
  );
}
