import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

import type { NativeSegmentedControlProps } from '@/types/native-ui';

export default function NativeSegmentedControlSwiftUI({
  onSelectedIndexChange,
  options,
  selectedIndex,
}: NativeSegmentedControlProps) {
  return (
    <Host matchContents>
      <Picker
        onSelectionChange={(selection) => onSelectedIndexChange(Number(selection))}
        selection={selectedIndex}
        modifiers={[pickerStyle('segmented')]}
      >
        {options.map((option, index) => (
          <Text key={option} modifiers={[tag(index)]}>
            {option}
          </Text>
        ))}
      </Picker>
    </Host>
  );
}
