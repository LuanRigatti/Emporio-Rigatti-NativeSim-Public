import { Button, Group, HStack, Host, ScrollView, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  clipShape,
  containerRelativeFrame,
  disabled,
  frame,
  fixedSize,
  glassEffect,
  hidden,
  padding,
  scaleEffect,
  scrollIndicators,
  foregroundStyle,
} from '@expo/ui/swift-ui/modifiers';

import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import type { NativeRetailFinanceCategorySelectorProps } from './NativeRetailFinanceCategorySelector.types';

export default function NativeRetailFinanceCategorySelectorSwiftUI({
  accessibilityLabel: label,
  contentLeadingPadding,
  contentTrailingPadding,
  fillAvailableWidth,
  items,
  itemHorizontalPadding,
  itemSpacing,
  onChange,
  selectedKey,
  selectedVisualScale,
  style,
}: NativeRetailFinanceCategorySelectorProps) {
  const { theme } = useAppTheme();
  const horizontalPadding = itemHorizontalPadding ?? 10;
  const minimumSpacing = itemSpacing ?? 10;
  const content = (
    <HStack
      modifiers={[
        ...(fillAvailableWidth ? [frame({ alignment: 'leading', maxWidth: Infinity })] : []),
        fillAvailableWidth
          ? padding({
              leading: contentLeadingPadding ?? 4,
              trailing: contentTrailingPadding ?? 4,
            })
          : padding({ leading: 4, trailing: contentTrailingPadding ?? 12 }),
      ]}
      spacing={fillAvailableWidth ? 0 : minimumSpacing}
    >
      {items.map((item) => {
        const selected = item.key === selectedKey;
        const renderButton = (buttonSelected: boolean, footprintOnly = false) => (
          <Button
            label={item.label}
            modifiers={[
              buttonBorderShape('capsule'),
              buttonStyle(buttonSelected ? 'glassProminent' : 'plain'),
              ...(buttonSelected ? [foregroundStyle(theme.colors.contrastContent)] : []),
              fixedSize({ horizontal: true }),
              frame({ minHeight: 46 }),
              padding({ horizontal: horizontalPadding }),
              ...(buttonSelected && !footprintOnly && selectedVisualScale !== undefined
                ? [scaleEffect(selectedVisualScale)]
                : []),
              ...(footprintOnly ? [accessibilityHidden(), disabled(), hidden()] : []),
              accessibilityLabel(`${label ?? 'Visão financeira'}: ${item.label}`),
            ]}
            onPress={
              footprintOnly
                ? undefined
                : () => {
                    if (!selected) triggerLightImpactHaptic();
                    onChange(item.key);
                  }
            }
          />
        );
        const button = renderButton(selected);

        return fillAvailableWidth ? (
          <HStack
            key={item.key}
            modifiers={[
              containerRelativeFrame({
                alignment: 'center',
                axes: 'horizontal',
                count: items.length,
                span: 1,
                spacing: 0,
              }),
            ]}
          >
            {button}
          </HStack>
        ) : (
          <ZStack alignment="center" key={item.key}>
            {renderButton(true, true)}
            {button}
          </ZStack>
        );
      })}
    </HStack>
  );

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
          {fillAvailableWidth ? (
            <Group modifiers={[frame({ alignment: 'leading', maxWidth: Infinity })]}>
              {content}
            </Group>
          ) : (
            content
          )}
        </ScrollView>
      </HStack>
    </Host>
  );
}
