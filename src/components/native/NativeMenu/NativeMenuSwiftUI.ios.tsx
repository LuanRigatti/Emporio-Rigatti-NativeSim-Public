import { Button, ContextMenu, Host } from '@expo/ui/swift-ui';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { NativeMenuProps } from '@/types/native-ui';

export default function NativeMenuSwiftUI({ actions, children }: NativeMenuProps) {
  return (
    <Host matchContents>
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
        <ContextMenu.Trigger>{children}</ContextMenu.Trigger>
      </ContextMenu>
    </Host>
  );
}
