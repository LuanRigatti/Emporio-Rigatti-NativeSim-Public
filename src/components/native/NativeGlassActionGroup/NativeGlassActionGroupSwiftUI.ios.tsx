import { useId } from 'react';
import { Button, GlassEffectContainer, HStack, Host, Image, Namespace } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  animation,
  Animation,
  buttonStyle,
  disabled as disabledModifier,
  frame,
  glassEffectId,
  glassEffect,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { NativeGlassActionGroupProps } from './NativeGlassActionGroup.types';

export default function NativeGlassActionGroupSwiftUI({
  color,
  disabled,
  leadingAccessibilityLabel,
  leadingSystemImage,
  onLeadingPress,
  onTrailingPress,
  selectionAction,
  selectionMode = false,
  size = 20,
  trailingAccessibilityLabel,
  trailingSystemImage,
}: NativeGlassActionGroupProps) {
  const namespaceId = useId();
  const isSelectionActionVisible = selectionMode && Boolean(selectionAction);
  const activeSelectionAction = isSelectionActionVisible ? selectionAction : null;
  const transitionAnimation = animation(
    Animation.spring({ duration: 0.42, bounce: 0.08 }),
    isSelectionActionVisible,
  );
  const buttonModifiers = [
    padding({ all: 0 }),
    buttonStyle('plain'),
    frame({ width: 44, height: 44 }),
    ...(disabled ? [disabledModifier(true)] : []),
    ...(color ? [tint(color)] : []),
  ];

  return (
    <Host matchContents>
      <Namespace id={namespaceId}>
        <GlassEffectContainer modifiers={[transitionAnimation]} spacing={0}>
          {isSelectionActionVisible ? (
            <HStack modifiers={[frame({ width: 104, height: 44, alignment: 'trailing' })]}>
              <Button
                modifiers={[
                  ...buttonModifiers,
                  glassEffect({
                    glass: { interactive: true, variant: 'regular' },
                    shape: 'circle',
                  }),
                  glassEffectId('registro-action-group', namespaceId),
                  accessibilityLabel(activeSelectionAction!.accessibilityLabel),
                ]}
                onPress={activeSelectionAction!.onPress}
              >
                <Image
                  color={color}
                  size={size}
                  systemName={activeSelectionAction!.systemImage as SFSymbol}
                />
              </Button>
            </HStack>
          ) : (
            <HStack
              spacing={4}
              modifiers={[
                padding({ horizontal: 6, vertical: 0 }),
                frame({ width: 104, height: 44, alignment: 'center' }),
                glassEffect({
                  glass: { interactive: true, variant: 'regular' },
                  shape: 'capsule',
                }),
                glassEffectId('registro-action-group', namespaceId),
              ]}
            >
              <Button
                modifiers={[...buttonModifiers, accessibilityLabel(leadingAccessibilityLabel)]}
                onPress={onLeadingPress}
              >
                <Image color={color} size={size} systemName={leadingSystemImage as SFSymbol} />
              </Button>
              <Button
                modifiers={[...buttonModifiers, accessibilityLabel(trailingAccessibilityLabel)]}
                onPress={onTrailingPress}
              >
                <Image color={color} size={size} systemName={trailingSystemImage as SFSymbol} />
              </Button>
            </HStack>
          )}
        </GlassEffectContainer>
      </Namespace>
    </Host>
  );
}
