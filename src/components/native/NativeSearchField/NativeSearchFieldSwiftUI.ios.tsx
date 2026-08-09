import { HStack, Host, Image, TextField, useNativeState } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  animation,
  Animation,
  frame,
  glassEffect,
  onSubmit as onSubmitModifier,
  padding,
  strokeBorder,
  submitLabel,
} from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';
import { useEffect, useState } from 'react';
import { roundedFont } from '../nativeTypography';

import type { NativeSearchFieldProps } from './NativeSearchField.types';

export default function NativeSearchFieldSwiftUI({
  accessibilityLabel: label,
  onChangeText,
  onFocusChange,
  onSubmit,
  placeholder = 'Pesquisar',
  value,
}: NativeSearchFieldProps) {
  const text = useNativeState(value);
  const [focused, setFocused] = useState(false);

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
          strokeBorder({
            color: PlatformColor('separator') as unknown as string,
            shape: 'capsule',
            style: { lineWidth: focused ? 1.2 : 0.5 },
          }),
          animation(Animation.easeInOut({ duration: 0.6 }), focused),
          accessibilityLabel(label ?? 'Pesquisar'),
        ]}
      >
        <Image color="#8B8B93" size={18} systemName="magnifyingglass" />
        <TextField
          axis="horizontal"
          modifiers={[
            roundedFont({ textStyle: 'body' }),
            frame({ maxWidth: 1000 }),
            submitLabel('search'),
            onSubmitModifier(() => onSubmit?.()),
          ]}
          onFocusChange={(nextFocused) => {
            setFocused(nextFocused);
            onFocusChange?.(nextFocused);
          }}
          onTextChange={onChangeText}
          placeholder={placeholder}
          text={text}
        />
      </HStack>
    </Host>
  );
}
