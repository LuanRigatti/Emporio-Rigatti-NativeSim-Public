import { Button, Host, Image } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  frame,
  glassEffect,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { NativeGlassIconButtonProps } from '@/types/native-ui';

export default function NativeGlassIconButtonSwiftUI({
  accessibilityLabel: label,
  color,
  containerSize,
  disabled,
  interactiveGlass = false,
  onPress,
  size,
  systemImage,
  style,
}: NativeGlassIconButtonProps) {
  return (
    <Host matchContents style={style}>
      <Button
        controlSize="regular"
        disabled={disabled}
        modifiers={[
          padding({ all: 0 }),
          buttonStyle(interactiveGlass ? 'plain' : 'glass'),
          frame({ width: containerSize, height: containerSize }),
          ...(interactiveGlass
            ? [
                glassEffect({
                  glass: { interactive: true, variant: 'regular' },
                  shape: 'circle',
                }),
              ]
            : []),
          ...(color ? [tint(color)] : []),
          accessibilityLabel(label),
        ]}
        onPress={onPress}
      >
        <Image color={color} size={size} systemName={systemImage as SFSymbol} />
      </Button>
    </Host>
  );
}
