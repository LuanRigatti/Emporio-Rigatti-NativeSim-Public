import { Button, HStack, Host, Image, Menu, Text } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  disabled as disabledModifier,
  frame,
  fixedSize,
  font,
  foregroundColor,
  glassEffect,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { NativeDropdownProps } from '@/types/native-ui';

export default function NativeDropdownSwiftUI<T extends string | number>({
  accessibilityLabel: label,
  color,
  disabled,
  items,
  label: triggerLabel,
  onValueChange,
  selectedValue,
  variant = 'glass',
}: NativeDropdownProps<T>) {
  const selectedItem = items.find((item) => item.value === selectedValue) ?? items[0];
  const displayValue = triggerLabel?.trim() || selectedItem?.label?.trim() || String(selectedValue);
  const trigger = (
    <HStack
      spacing={6}
      modifiers={[
        padding({ horizontal: 12, vertical: 10 }),
        frame({ minHeight: 44 }),
        ...(variant === 'glass'
          ? [
              glassEffect({
                glass: { interactive: true, variant: 'regular' },
                shape: 'capsule',
              }),
            ]
          : []),
        ...(label ? [accessibilityLabel(label)] : []),
      ]}
    >
      <Text
        modifiers={[
          fixedSize({ horizontal: true, vertical: false }),
          font({ size: 15, weight: 'medium' }),
          ...(color ? [foregroundColor(color)] : []),
        ]}
      >
        {displayValue}
      </Text>
      <Image color={color} size={14} systemName={'chevron.down' as SFSymbol} />
    </HStack>
  );

  return (
    <Host matchContents>
      {disabled ? (
        trigger
      ) : (
        <Menu label={trigger} modifiers={[buttonStyle('plain')]}>
          {items.map((item) => (
            <Button
              key={String(item.value)}
              label={item.label}
              modifiers={item.disabled ? [disabledModifier(true)] : undefined}
              onPress={() => onValueChange(item.value)}
            />
          ))}
        </Menu>
      )}
    </Host>
  );
}
