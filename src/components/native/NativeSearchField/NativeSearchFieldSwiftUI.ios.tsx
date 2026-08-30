import { Button, HStack, Host, Image, TextField, useNativeState } from '@expo/ui/swift-ui';
import type { TextFieldRef } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  animation,
  Animation,
  buttonStyle,
  frame,
  glassEffect,
  multilineTextAlignment,
  onSubmit as onSubmitModifier,
  offset,
  padding,
  strokeBorder,
  submitLabel,
} from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { roundedFont } from '../nativeTypography';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import type { NativeSearchFieldProps } from './NativeSearchField.types';

export default function NativeSearchFieldSwiftUI({
  accessibilityLabel: label,
  onChangeText,
  onFocusChange,
  onPressHelp,
  onSubmit,
  placeholder = 'Pesquisar',
  value,
}: NativeSearchFieldProps) {
  const text = useNativeState(value);
  const textFieldRef = useRef<TextFieldRef>(null);
  const [focused, setFocused] = useState(false);

  const handleNativeSubmit = () => {
    onSubmit?.(text.get());
  };

  useEffect(() => {
    text.set(value);
  }, [text, value]);

  return (
    <Host style={{ minHeight: 36, width: '100%' }}>
      <HStack
        spacing={20}
        modifiers={[
          frame({ maxWidth: 1000, minHeight: 36 }),
          padding({ horizontal: 12, vertical: 8 }),
          glassEffect({
            glass: {
              interactive: true,
              variant: 'regular',
            },
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
        <Image
          color="#8B8B93"
          modifiers={[offset({ x: 12 })]}
          size={18}
          systemName="magnifyingglass"
        />
        <TextField
          axis="horizontal"
          ref={textFieldRef}
          modifiers={[
            roundedFont({ size: 18 }),
            frame({ maxWidth: 1000 }),
            multilineTextAlignment('leading'),
            submitLabel('search'),
            onSubmitModifier(handleNativeSubmit),
          ]}
          onFocusChange={(nextFocused) => {
            if (nextFocused) {
              triggerLightImpactHaptic();
            }
            setFocused(nextFocused);
            onFocusChange?.(nextFocused);
          }}
          onTextChange={onChangeText}
          placeholder={placeholder}
          text={text}
        />
        {focused && !value && onPressHelp ? (
          <Button
            modifiers={[
              buttonStyle('plain'),
              padding({ all: 0 }),
              accessibilityLabel('Ajuda da pesquisa'),
            ]}
            onPress={() => {
              triggerLightImpactHaptic();
              onPressHelp();
              void textFieldRef.current?.blur();
            }}
          >
            <Image color="#8B8B93" size={18} systemName="questionmark.circle" />
          </Button>
        ) : null}
      </HStack>
    </Host>
  );
}
