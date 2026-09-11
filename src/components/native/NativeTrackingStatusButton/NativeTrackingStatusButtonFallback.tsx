import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/premium';
import { useAppTheme } from '@/theme';
import type { NativeTrackingStatusButtonProps } from './NativeTrackingStatusButton.types';

export default function NativeTrackingStatusButtonFallback({
  accessibilityLabel: accessibilityText,
  active,
  activeLabel = 'Ao vivo',
  busy = false,
  color,
  containerHeight = 56,
  containerWidth = 132,
  disabled = false,
  idleLabel = 'Iniciar',
  onPress,
  style,
}: NativeTrackingStatusButtonProps) {
  const { theme } = useAppTheme();
  const [breatheAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!active) {
      breatheAnim.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          toValue: 0.35,
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
      breatheAnim.setValue(1);
    };
  }, [active, breatheAnim]);

  const isDisabled = disabled || busy;
  const labelText = active ? activeLabel : idleLabel;
  const textColor = color ?? theme.colors.textPrimary;
  const a11yLabel = accessibilityText ?? (active ? 'Parar rastreamento' : 'Iniciar rastreamento');

  return (
    <GlassSurface
      interactive={!isDisabled}
      style={[
        styles.surface,
        {
          borderRadius: containerHeight / 2,
          height: containerHeight,
          opacity: isDisabled ? theme.opacities.disabled : 1,
          width: containerWidth,
        },
        style,
      ]}
    >
      <Pressable
        accessibilityLabel={a11yLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        disabled={isDisabled}
        onPress={onPress}
        style={({ pressed }) => [styles.button, { opacity: pressed ? theme.opacities.pressed : 1 }]}
      >
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.indicator,
              active ? styles.indicatorActive : styles.indicatorIdle,
              active ? { opacity: breatheAnim } : null,
            ]}
          />
          <Text style={[styles.label, { color: textColor }]}>{labelText}</Text>
        </View>
      </Pressable>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  surface: {
    overflow: 'hidden',
  },
  button: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  indicator: {
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  indicatorIdle: {
    backgroundColor: 'transparent',
    borderColor: '#8E8E93',
    borderWidth: 1.5,
  },
  indicatorActive: {
    backgroundColor: '#30D158',
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
  },
});
