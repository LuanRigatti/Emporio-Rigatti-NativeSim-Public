import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

import type { NativePickerProps } from '@/types/native-ui';
import { roundedFont } from '../nativeTypography';

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
        onSelectionChange={(selection) => onSelectedIndexChange(Number(selection))}
        selection={selectedIndex}
        modifiers={[pickerStyle('menu')]}
      >
        {options.map((option, index) => (
          <Text key={option} modifiers={[roundedFont({}), tag(index)]}>
            {option}
          </Text>
        ))}
      </Picker>
    </Host>
  );
}
