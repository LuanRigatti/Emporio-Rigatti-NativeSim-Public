import { Button, ContextMenu, Host, Image } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
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
      <ContextMenu activationMethod="singlePress" modifiers={[buttonStyle('plain')]}>
        <ContextMenu.Items>
          {actions.map((action) => (
            <Button
              disabled={action.disabled}
              key={action.id}
              onPress={action.onPress}
              role={action.destructive ? 'destructive' : 'default'}
              systemImage={action.systemImage as SFSymbol | undefined}
            >
              {action.title}
            </Button>
          ))}
        </ContextMenu.Items>
        <ContextMenu.Trigger>
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
        </ContextMenu.Trigger>
      </ContextMenu>
    </Host>
  );
}
