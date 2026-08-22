import { Button, Host, Image, Text } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  frame,
  glassEffect,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { NativeGlassIconButtonProps } from '@/types/native-ui';
import { roundedFont } from '../nativeTypography';

export default function NativeGlassIconButtonSwiftUI({
  accessibilityLabel: accessibilityText,
  color,
  containerSize,
  containerWidth,
  disabled,
  glassTint,
  interactiveGlass = false,
  label,
  onPress,
  size,
  shape = 'circle',
  systemImage,
  style,
}: NativeGlassIconButtonProps) {
  return (
    <Host matchContents style={style}>
      <Button
        modifiers={[
          padding({ all: 0 }),
          buttonStyle(interactiveGlass ? 'plain' : 'glass'),
          controlSize('regular'),
          ...(disabled ? [disabledModifier(true)] : []),
          frame({ width: containerWidth ?? containerSize, height: containerSize }),
          ...(interactiveGlass
            ? [
                glassEffect({
                  glass: { interactive: true, tint: glassTint, variant: 'regular' },
                  shape,
                }),
              ]
            : []),
          ...(color ? [tint(color)] : []),
          accessibilityLabel(accessibilityText),
        ]}
        onPress={onPress}
      >
        {label ? (
          <Text modifiers={[roundedFont({}), ...(color ? [tint(color)] : [])]}>{label}</Text>
        ) : (
          <Image color={color} size={size} systemName={(systemImage ?? 'plus') as SFSymbol} />
        )}
      </Button>
    </Host>
  );
}
