import { Host, Label, Picker, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { NativeSegmentedControlProps } from '@/types/native-ui';

export default function NativeSegmentedControlSwiftUI({
  onSelectedIndexChange,
  options,
  selectedIndex,
  systemImages,
}: NativeSegmentedControlProps) {
  return (
    <Host matchContents>
      <Picker
        onSelectionChange={(selection) => onSelectedIndexChange(Number(selection))}
        selection={selectedIndex}
        modifiers={[pickerStyle('segmented')]}
      >
        {options.map((option, index) =>
          systemImages?.[index] ? (
            <Label
              key={option}
              modifiers={[tag(index)]}
              title={option}
              systemImage={systemImages[index] as SFSymbol}
            />
          ) : (
            <Text key={option} modifiers={[tag(index)]}>
              {option}
            </Text>
          ),
        )}
      </Picker>
    </Host>
  );
}
