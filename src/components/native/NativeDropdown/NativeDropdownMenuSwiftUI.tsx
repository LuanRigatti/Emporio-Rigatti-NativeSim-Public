import { Button, HStack, Image, Menu, Text } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  disabled as disabledModifier,
  fixedSize,
  font,
  foregroundColor,
  frame,
  glassEffect,
  onTapGesture,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { NativeDropdownItem, NativeDropdownVariant } from './NativeDropdown.types';

export type NativeDropdownMenuSwiftUIProps<T extends string | number> = {
  accessibilityLabel?: string;
  color?: string;
  compact?: boolean;
  disabled?: boolean;
  displayValue: string;
  fontSize?: number;
  hapticOnOpen?: () => void;
  hideChevron?: boolean;
  iconOnly?: boolean;
  items: readonly NativeDropdownItem<T>[];
  leadingSystemImage?: string;
  onValueChange: (value: T) => void;
  selectedValue: T;
  variant: NativeDropdownVariant;
};

export function NativeDropdownMenuSwiftUI<T extends string | number>({
  accessibilityLabel: label,
  color,
  compact = false,
  disabled = false,
  displayValue,
  fontSize = 15,
  hapticOnOpen,
  hideChevron = false,
  iconOnly = false,
  items,
  leadingSystemImage,
  onValueChange,
  variant,
}: NativeDropdownMenuSwiftUIProps<T>) {
  const triggerModifiers = [
    padding({ horizontal: compact ? 6 : 12, vertical: 10 }),
    frame({ minHeight: 44, minWidth: iconOnly ? 44 : undefined }),
    ...(variant === 'glass'
      ? [
          glassEffect({
            glass: { interactive: true, variant: 'regular' },
            shape: 'capsule',
          }),
        ]
      : []),
    ...(label ? [accessibilityLabel(label)] : []),
  ];

  const trigger = (
    <HStack spacing={6} modifiers={triggerModifiers}>
      {leadingSystemImage ? (
        <Image
          color={color}
          size={iconOnly ? 18 : 14}
          systemName={leadingSystemImage as SFSymbol}
        />
      ) : null}
      {iconOnly ? null : (
        <Text
          modifiers={[
            fixedSize({ horizontal: true, vertical: false }),
            font({ size: fontSize, weight: 'medium' }),
            ...(color ? [foregroundColor(color)] : []),
          ]}
        >
          {displayValue}
        </Text>
      )}
      {iconOnly || hideChevron ? null : (
        <Image color={color} size={14} systemName={'chevron.down' as SFSymbol} />
      )}
    </HStack>
  );

  if (disabled) return trigger;

  return (
    <Menu
      label={trigger}
      modifiers={[buttonStyle('plain'), ...(hapticOnOpen ? [onTapGesture(hapticOnOpen)] : [])]}
    >
      {items.map((item) => (
        <Button
          key={String(item.value)}
          label={item.label}
          modifiers={item.disabled ? [disabledModifier(true)] : undefined}
          onPress={() => onValueChange(item.value)}
        />
      ))}
    </Menu>
  );
}
