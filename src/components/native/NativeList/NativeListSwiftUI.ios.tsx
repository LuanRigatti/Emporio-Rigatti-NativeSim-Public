import { Button, Host, List } from '@expo/ui/swift-ui';
import { disabled as disabledModifier, listStyle } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { NativeListProps } from '@/types/native-ui';

export default function NativeListSwiftUI({ items, onItemPress }: NativeListProps) {
  return (
    <Host style={{ flex: 1 }}>
      <List modifiers={[listStyle('insetGrouped')]}>
        {items.map((item) => (
          <Button
            key={item.id}
            modifiers={item.disabled ? [disabledModifier(true)] : undefined}
            onPress={() => onItemPress?.(item)}
            systemImage={item.systemImage as SFSymbol | undefined}
            label={item.subtitle ? `${item.title}\n${item.subtitle}` : item.title}
          />
        ))}
      </List>
    </Host>
  );
}
