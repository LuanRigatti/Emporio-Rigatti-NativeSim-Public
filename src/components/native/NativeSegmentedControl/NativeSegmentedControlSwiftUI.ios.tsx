import { Host, Picker } from '@expo/ui/swift-ui';

import type { NativeSegmentedControlProps } from '@/types/native-ui';

export default function NativeSegmentedControlSwiftUI({
  onSelectedIndexChange,
  options,
  selectedIndex,
}: NativeSegmentedControlProps) {
  return (
    <Host matchContents>
      <Picker
        onOptionSelected={({ nativeEvent }) => onSelectedIndexChange(nativeEvent.index)}
        options={[...options]}
        selectedIndex={selectedIndex}
        variant="segmented"
      />
    </Host>
  );
}
