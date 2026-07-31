import { Button, HStack, Host, Image } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  disabled as disabledModifier,
  frame,
  glassEffect,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { NativeGlassActionGroupProps } from './NativeGlassActionGroup.types';

export default function NativeGlassActionGroupSwiftUI({
  color,
  disabled,
  leadingAccessibilityLabel,
  leadingSystemImage,
  onLeadingPress,
  onTrailingPress,
  size = 20,
  trailingAccessibilityLabel,
  trailingSystemImage,
}: NativeGlassActionGroupProps) {
  const buttonModifiers = [
    padding({ all: 0 }),
    buttonStyle('plain'),
    frame({ width: 44, height: 44 }),
    ...(disabled ? [disabledModifier(true)] : []),
    ...(color ? [tint(color)] : []),
  ];

  return (
    <Host matchContents>
      <HStack
        spacing={8}
        modifiers={[
          padding({ horizontal: 8, vertical: 0 }),
          glassEffect({
            glass: { interactive: true, variant: 'regular' },
            shape: 'capsule',
          }),
        ]}
      >
        <Button
          modifiers={[...buttonModifiers, accessibilityLabel(leadingAccessibilityLabel)]}
          onPress={onLeadingPress}
        >
          <Image color={color} size={size} systemName={leadingSystemImage as SFSymbol} />
        </Button>
        <Button
          modifiers={[...buttonModifiers, accessibilityLabel(trailingAccessibilityLabel)]}
          onPress={onTrailingPress}
        >
          <Image color={color} size={size} systemName={trailingSystemImage as SFSymbol} />
        </Button>
      </HStack>
    </Host>
  );
}
