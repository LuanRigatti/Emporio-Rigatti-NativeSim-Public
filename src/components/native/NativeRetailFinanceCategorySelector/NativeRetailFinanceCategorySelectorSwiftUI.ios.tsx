import { Button, HStack, Host, ScrollView } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  clipShape,
  frame,
  fixedSize,
  glassEffect,
  padding,
  scrollIndicators,
  foregroundStyle,
} from '@expo/ui/swift-ui/modifiers';

import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import type { NativeRetailFinanceCategorySelectorProps } from './NativeRetailFinanceCategorySelector.types';

export default function NativeRetailFinanceCategorySelectorSwiftUI({
  accessibilityLabel: label,
  items,
  onChange,
  selectedKey,
  style,
}: NativeRetailFinanceCategorySelectorProps) {
  const { theme } = useAppTheme();

  return (
    <Host style={[{ minHeight: 54, width: '100%' }, style]}>
      <HStack
        modifiers={[
          frame({ alignment: 'leading', maxWidth: Infinity }),
          padding({ horizontal: 4, vertical: 4 }),
          clipShape('capsule'),
          glassEffect({
            glass: { interactive: true, variant: 'regular' },
            shape: 'capsule',
          }),
        ]}
      >
        <ScrollView
          axes="horizontal"
          modifiers={[frame({ maxWidth: Infinity }), scrollIndicators('never', 'horizontal')]}
          showsIndicators={false}
        >
          <HStack modifiers={[padding({ leading: 4, trailing: 12 })]} spacing={10}>
            {items.map((item) => {
              const selected = item.key === selectedKey;
              return (
                <Button
                  key={item.key}
                  label={item.label}
                  modifiers={[
                    buttonBorderShape('capsule'),
                    buttonStyle(selected ? 'glassProminent' : 'plain'),
                    ...(selected ? [foregroundStyle(theme.colors.contrastContent)] : []),
                    fixedSize({ horizontal: true }),
                    frame({ minHeight: 46 }),
                    padding({ horizontal: 10 }),
                    accessibilityLabel(`${label ?? 'Visão financeira'}: ${item.label}`),
                  ]}
                  onPress={() => {
                    if (!selected) triggerLightImpactHaptic();
                    onChange(item.key);
                  }}
                />
              );
            })}
          </HStack>
        </ScrollView>
      </HStack>
    </Host>
  );
}
