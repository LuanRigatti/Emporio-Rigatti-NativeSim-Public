import { Button, Host, Menu } from '@expo/ui/swift-ui';
import { disabled as disabledModifier } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { NativeMenuProps } from '@/types/native-ui';
import { roundedFont } from '../nativeTypography';

export default function NativeMenuSwiftUI({ actions, children }: NativeMenuProps) {
  return (
    <Host matchContents>
      <Menu label={children}>
        {actions.map((action) => (
          <Button
            key={action.id}
            label={action.title}
            modifiers={[roundedFont({}), ...(action.disabled ? [disabledModifier(true)] : [])]}
            onPress={action.onPress}
            role={action.destructive ? 'destructive' : 'default'}
            systemImage={action.systemImage as SFSymbol | undefined}
          />
        ))}
      </Menu>
    </Host>
  );
}
