import { Button, Host, Image } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, frame, tint } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { NativeGlassIconButtonProps } from '@/types/native-ui';

export default function NativeGlassIconButtonSwiftUI({
  accessibilityLabel: label,
  color,
  containerSize,
  disabled,
  onPress,
  size,
  systemImage,
  style,
}: NativeGlassIconButtonProps) {
  return (
    <Host matchContents style={style}>
      <Button
        disabled={disabled}
        modifiers={[
          frame({ width: containerSize, height: containerSize }),
          buttonStyle('glass'),
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
