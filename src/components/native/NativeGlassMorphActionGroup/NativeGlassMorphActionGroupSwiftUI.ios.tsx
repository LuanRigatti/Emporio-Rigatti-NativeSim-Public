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
  matchedGeometryEffect,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import type { NativeGlassMorphActionGroupProps } from './NativeGlassMorphActionGroup.types';

const BUTTON_SIZE = 44;
const INNER_SPACING = 2;
const EXPANDED_WIDTH = BUTTON_SIZE * 2 + INNER_SPACING;

export default function NativeGlassMorphActionGroupSwiftUI({
  color,
  isExpanded: controlledExpanded,
  onToggle,
  onSecondaryPress,
  primaryCollapsedSymbol = 'ellipsis',
  primaryExpandedSymbol = 'xmark',
  secondarySymbol = 'plus',
  size = 20,
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

  const innerButtonModifiers = [
    padding({ all: 0 }),
    buttonStyle('plain'),
    frame({ height: BUTTON_SIZE, width: BUTTON_SIZE }),
    ...(color ? [tint(color)] : []),
  ];

  return (
    <Host
      matchContents
      style={[{ height: BUTTON_SIZE, minWidth: EXPANDED_WIDTH, width: EXPANDED_WIDTH }, style]}
    >
      <Namespace id={namespaceId}>
        <GlassEffectContainer
          modifiers={[
            animation(Animation.spring({ bounce: 0.04, duration: 0.24 }), expanded),
            frame({ alignment: 'trailing', height: BUTTON_SIZE, width: EXPANDED_WIDTH }),
          ]}
        >
          <HStack
            modifiers={[
              padding({ all: 0 }),
              glassEffect({
                glass: { interactive: true, variant: 'regular' },
                shape: 'capsule',
              }),
              glassEffectId('glass-morph-surface', namespaceId),
              matchedGeometryEffect('glass-morph-surface', namespaceId),
            ]}
            spacing={INNER_SPACING}
          >
            {expanded ? (
              <>
                <Button
                  modifiers={[...innerButtonModifiers, accessibilityLabel('Ação secundária')]}
                  onPress={onSecondaryPress}
                >
                  <Image color={color} size={size} systemName={secondarySymbol} />
                </Button>
                <Button
                  modifiers={[...innerButtonModifiers, accessibilityLabel('Fechar')]}
                  onPress={handleToggle}
                >
                  <Image color={color} size={size} systemName={primaryExpandedSymbol} />
                </Button>
              </>
            ) : (
              <Button
                modifiers={[...innerButtonModifiers, accessibilityLabel('Mais opções')]}
                onPress={handleToggle}
              >
                <Image color={color} size={size} systemName={primaryCollapsedSymbol} />
              </Button>
            )}
          </HStack>
        </GlassEffectContainer>
      </Namespace>
    </Host>
  );
}
