import { Button, Host, List } from '@expo/ui/swift-ui';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { NativeListProps } from '@/types/native-ui';

export default function NativeListSwiftUI({ items, onItemPress }: NativeListProps) {
  return (
    <Host style={{ flex: 1 }}>
      <List listStyle="insetGrouped">
        {items.map((item) => (
          <Button
            disabled={item.disabled}
            key={item.id}
            onPress={() => onItemPress?.(item)}
            systemImage={item.systemImage as SFSymbol | undefined}
          >
            {item.subtitle ? `${item.title}\n${item.subtitle}` : item.title}
          </Button>
        ))}
      </List>
    </Host>
  );
}
