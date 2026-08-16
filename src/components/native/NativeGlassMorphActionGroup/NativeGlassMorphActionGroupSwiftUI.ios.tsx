import { useId, useState } from 'react';
import { Button, GlassEffectContainer, HStack, Host, Image, Namespace } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  animation,
  Animation,
  buttonStyle,
  frame,
  glassEffect,
  glassEffectId,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import type { NativeGlassMorphActionGroupProps } from './NativeGlassMorphActionGroup.types';

export default function NativeGlassMorphActionGroupSwiftUI({
  color,
  isExpanded: controlledExpanded,
  onToggle,
  onSecondaryPress,
  primaryCollapsedSymbol = 'ellipsis',
  primaryExpandedSymbol = 'xmark',
  secondarySymbol = 'plus',
  size = 20,
  spacing = 8,
  style,
}: NativeGlassMorphActionGroupProps) {
  const namespaceId = useId();
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    const next = !expanded;
    if (onToggle) {
      onToggle(next);
    } else {
      setInternalExpanded(next);
    }
  };

  const buttonBaseModifiers = [
    padding({ all: 0 }),
    buttonStyle('plain'),
    frame({ width: 44, height: 44 }),
    ...(color ? [tint(color)] : []),
  ];

  return (
    <Host matchContents style={style}>
      <Namespace id={namespaceId}>
        <GlassEffectContainer
          modifiers={[animation(Animation.spring({ duration: 0.42, bounce: 0.12 }), expanded)]}
          spacing={spacing}
        >
          <HStack spacing={spacing}>
            <Button
              modifiers={[
                ...buttonBaseModifiers,
                glassEffect({
                  glass: { interactive: true, variant: 'regular' },
                  shape: 'circle',
                }),
                glassEffectId('morph-action-primary', namespaceId),
                accessibilityLabel(expanded ? 'Fechar' : 'Mais opções'),
              ]}
              onPress={handleToggle}
            >
              <Image
                color={color}
                size={size}
                systemName={expanded ? primaryExpandedSymbol : primaryCollapsedSymbol}
              />
            </Button>

            {expanded ? (
              <Button
                modifiers={[
                  ...buttonBaseModifiers,
                  glassEffect({
                    glass: { interactive: true, variant: 'regular' },
                    shape: 'circle',
                  }),
                  glassEffectId('morph-action-secondary', namespaceId),
                  accessibilityLabel('Ação secundária'),
                ]}
                onPress={onSecondaryPress}
              >
                <Image color={color} size={size} systemName={secondarySymbol} />
              </Button>
            ) : null}
          </HStack>
        </GlassEffectContainer>
      </Namespace>
    </Host>
  );
}
