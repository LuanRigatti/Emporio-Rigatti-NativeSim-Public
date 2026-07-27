import { Button, ContextMenu, Host, Image } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, frame, tint } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { NativeGlassMenuProps } from '@/types/native-ui';

export default function NativeGlassMenuSwiftUI({
  accessibilityLabel: label,
  actions,
  color,
  containerSize,
  disabled,
  onPress,
  size,
  style,
  systemImage,
}: NativeGlassMenuProps) {
  return (
    <Host matchContents style={style}>
      <ContextMenu activationMethod="singlePress">
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
        </ContextMenu.Trigger>
      </ContextMenu>
    </Host>
  );
}
