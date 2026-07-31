import { HStack, Host, Image, TextField, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityLabel, frame, glassEffect, padding } from '@expo/ui/swift-ui/modifiers';
import { useEffect } from 'react';

import type { NativeSearchFieldProps } from './NativeSearchField.types';

export default function NativeSearchFieldSwiftUI({
  accessibilityLabel: label,
  onChangeText,
  placeholder = 'Pesquisar',
  value,
}: NativeSearchFieldProps) {
  const text = useNativeState(value);

  useEffect(() => {
    text.set(value);
  }, [text, value]);

  return (
    <Host style={{ minHeight: 36, width: '100%' }}>
      <HStack
        spacing={8}
        modifiers={[
          frame({ maxWidth: 1000, minHeight: 36 }),
          padding({ horizontal: 12, vertical: 8 }),
          glassEffect({
            glass: { interactive: true, variant: 'regular' },
            shape: 'capsule',
          }),
          accessibilityLabel(label ?? 'Pesquisar'),
        ]}
      >
        <Image color="#8B8B93" size={18} systemName="magnifyingglass" />
        <TextField
          axis="horizontal"
          modifiers={[frame({ maxWidth: 1000 })]}
          onTextChange={onChangeText}
          placeholder={placeholder}
          text={text}
        />
      </HStack>
    </Host>
  );
}
