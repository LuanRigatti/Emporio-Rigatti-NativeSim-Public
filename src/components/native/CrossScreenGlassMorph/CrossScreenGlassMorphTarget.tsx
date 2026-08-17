import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Button, GlassEffectContainer, HStack, Host, Image, Namespace } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  frame,
  glassEffect,
  glassEffectId,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { useCrossScreenGlassMorph } from './CrossScreenGlassMorphContext';

export type CrossScreenGlassMorphTargetProps = {
  morphId: string;
  shape?: 'circle' | 'capsule';
  symbols?: string[];
  color?: string;
  size?: number;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
};

export function CrossScreenGlassMorphTarget({
  color,
  height = 44,
  morphId,
  onPress,
  shape = 'circle',
  size = 20,
  style,
  symbols = ['ellipsis'],
  width = shape === 'circle' ? 44 : 100,
}: CrossScreenGlassMorphTargetProps) {
  const containerRef = useRef<View>(null);
  const { hiddenMorphIds, registerTarget, unregisterTarget } = useCrossScreenGlassMorph();
  const isHidden = hiddenMorphIds.has(morphId);

  const measureAndRegister = React.useCallback(() => {
    if (!containerRef.current) return;
    containerRef.current.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      if (measuredWidth > 0 && measuredHeight > 0) {
        registerTarget(morphId, {
          bounds: {
            height: measuredHeight,
            width: measuredWidth,
            x,
            y,
          },
          color,
          shape,
          size,
          symbols,
        });
      }
    });
  }, [morphId, shape, symbols, color, size, registerTarget]);

  useEffect(() => {
    measureAndRegister();
    return () => {
      unregisterTarget(morphId);
    };
  }, [morphId, measureAndRegister, unregisterTarget]);

  const innerButtonModifiers = [
    padding({ all: 0 }),
    buttonStyle('plain'),
    frame({ height, width: width / symbols.length }),
    ...(color ? [tint(color)] : []),
  ];

  const content =
    shape === 'circle' || symbols.length === 1 ? (
      <Button
        modifiers={[
          ...innerButtonModifiers,
          glassEffect({
            glass: { interactive: true, variant: 'regular' },
            shape: 'circle',
          }),
          glassEffectId(morphId, `target-ns-${morphId}`),
          accessibilityLabel(symbols[0]),
        ]}
        onPress={onPress}
      >
        <Image color={color} size={size} systemName={symbols[0] as any} />
      </Button>
    ) : (
      <HStack
        modifiers={[
          padding({ all: 0 }),
          glassEffect({
            glass: { interactive: true, variant: 'regular' },
            shape: 'capsule',
          }),
          glassEffectId(morphId, `target-ns-${morphId}`),
        ]}
        spacing={2}
      >
        {symbols.map((sym, index) => (
          <Button
            key={`target-${sym}-${index}`}
            modifiers={[...innerButtonModifiers, accessibilityLabel(sym)]}
            onPress={onPress}
          >
            <Image color={color} size={size} systemName={sym as any} />
          </Button>
        ))}
      </HStack>
    );

  return (
    <View
      ref={containerRef}
      onLayout={measureAndRegister}
      style={[styles.container, { height, opacity: isHidden ? 0 : 1, width }, style]}
    >
      <Host matchContents style={{ height, width }}>
        <Namespace id={`target-ns-${morphId}`}>
          <GlassEffectContainer modifiers={[frame({ alignment: 'center', height, width })]}>
            {content}
          </GlassEffectContainer>
        </Namespace>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
