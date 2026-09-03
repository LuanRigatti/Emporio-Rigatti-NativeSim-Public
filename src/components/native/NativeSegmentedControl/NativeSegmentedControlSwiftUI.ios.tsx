import { StyleSheet } from 'react-native';
import { Host, Label, Picker, Text } from '@expo/ui/swift-ui';
import { controlSize, frame, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { NativeSegmentedControlProps } from '@/types/native-ui';
import { roundedFont } from '../nativeTypography';

export default function NativeSegmentedControlSwiftUI({
  onSelectedIndexChange,
  options,
  selectedIndex,
  style,
  systemImages,
}: NativeSegmentedControlProps) {
  const nativeHeight = StyleSheet.flatten(style)?.height;

  return (
    <Host matchContents={!style} style={style}>
      <Picker
        onSelectionChange={(selection) => onSelectedIndexChange(Number(selection))}
        selection={selectedIndex}
        modifiers={[
          pickerStyle('segmented'),
          controlSize('large'),
          roundedFont({ size: 19, weight: 'semibold' }),
          ...(typeof nativeHeight === 'number'
            ? [frame({ alignment: 'center', height: nativeHeight, maxWidth: Infinity })]
            : []),
        ]}
      >
        {options.map((option, index) =>
          systemImages?.[index] ? (
            <Label
              key={option}
              modifiers={[roundedFont({ size: 19, weight: 'semibold' }), tag(index)]}
              title={option}
              systemImage={systemImages[index] as SFSymbol}
            />
          ) : (
            <Text
              key={option}
              modifiers={[roundedFont({ size: 19, weight: 'semibold' }), tag(index)]}
            >
              {option}
            </Text>
          ),
        )}
      </Picker>
    </Host>
  );
}
