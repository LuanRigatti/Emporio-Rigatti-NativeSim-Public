import { Button, Host, Image, Menu } from '@expo/ui/swift-ui';
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

import type { NativeGlassMenuProps } from '@/types/native-ui';

export default function NativeGlassMenuSwiftUI({
  accessibilityLabel: label,
  actions,
  color,
  containerSize,
  size,
  style,
  systemImage,
}: NativeGlassMenuProps) {
  return (
    <Host matchContents style={style}>
      <Menu
        label={
          <Image
            modifiers={[
              padding({ all: 0 }),
              frame({ width: containerSize, height: containerSize }),
              glassEffect({
                glass: { interactive: true, variant: 'regular' },
                shape: 'circle',
              }),
              ...(color ? [tint(color)] : []),
              accessibilityLabel(label),
            ]}
            color={color}
            size={size}
            systemName={systemImage as SFSymbol}
          />
        }
        modifiers={[buttonStyle('plain')]}
      >
        {actions.map((action) => (
          <Button
            key={action.id}
            label={action.title}
            modifiers={action.disabled ? [disabledModifier(true)] : undefined}
            onPress={action.onPress}
            role={action.destructive ? 'destructive' : 'default'}
            systemImage={action.systemImage as SFSymbol | undefined}
          />
        ))}
      </Menu>
    </Host>
  );
}
