import { Button, ContextMenu, HStack, Host, Image, Text } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  frame,
  fixedSize,
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
        color={color}
        modifiers={[fixedSize({ horizontal: true, vertical: false })]}
        size={15}
        weight="medium"
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
        <ContextMenu activationMethod="singlePress" modifiers={[buttonStyle('plain')]}>
          <ContextMenu.Items>
            {items.map((item) => (
              <Button
                disabled={item.disabled}
                key={String(item.value)}
                onPress={() => onValueChange(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </ContextMenu.Items>
          <ContextMenu.Trigger>{trigger}</ContextMenu.Trigger>
        </ContextMenu>
      )}
    </Host>
  );
}
