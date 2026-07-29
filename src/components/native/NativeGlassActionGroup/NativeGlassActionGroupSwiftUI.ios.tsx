import { Button, HStack, Host, Image } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
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
          disabled={disabled}
          modifiers={[...buttonModifiers, accessibilityLabel(leadingAccessibilityLabel)]}
          onPress={onLeadingPress}
        >
          <Image color={color} size={size} systemName={leadingSystemImage as SFSymbol} />
        </Button>
        <Button
          disabled={disabled}
          modifiers={[...buttonModifiers, accessibilityLabel(trailingAccessibilityLabel)]}
          onPress={onTrailingPress}
        >
          <Image color={color} size={size} systemName={trailingSystemImage as SFSymbol} />
        </Button>
      </HStack>
    </Host>
  );
}
