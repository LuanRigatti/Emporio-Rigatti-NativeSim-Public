import { HStack, Host, Image, Text } from '@expo/ui/swift-ui';
import { font, foregroundColor, offset } from '@expo/ui/swift-ui/modifiers';
import { useCallback, useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAppTheme } from '@/theme';

import type { HomeModeTitleProps } from './HomeModeTitleFallback';

const PRESSED_SCALE = 0.96;
const PRESS_IN_DURATION = 55;
const PRESS_OUT_DURATION = 150;

export default function HomeModeTitleSwiftUI({
  accessibilityLabel: accessibilityText,
  label,
  onPress,
}: HomeModeTitleProps) {
  const { reduceMotionEnabled, theme } = useAppTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const titleFont = font({ size: 36, weight: 'bold' });
  const animatePressed = useCallback(
    (pressed: boolean) => {
      Animated.timing(scale, {
        duration: reduceMotionEnabled ? 0 : pressed ? PRESS_IN_DURATION : PRESS_OUT_DURATION,
        toValue: pressed && !reduceMotionEnabled ? PRESSED_SCALE : 1,
        useNativeDriver: true,
      }).start();
    },
    [reduceMotionEnabled, scale],
  );

  return (
    <Animated.View style={[styles.container, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityHint="Abre o seletor de modo"
        accessibilityLabel={accessibilityText}
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={() => animatePressed(true)}
        onPressOut={() => animatePressed(false)}
      >
        <Host matchContents>
          <HStack alignment="center" spacing={6}>
            <Text modifiers={[titleFont, foregroundColor(theme.colors.textPrimary)]}>{label}</Text>
            <Image
              color={theme.colors.textSecondary}
              modifiers={[offset({ y: 3 })]}
              size={15}
              systemName={'chevron.up.chevron.down' as SFSymbol}
            />
          </HStack>
        </Host>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'flex-start' },
});
