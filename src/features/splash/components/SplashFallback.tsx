import { StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';
import { AppLogo } from '@/components/branding/AppLogo';

import type { SplashVisualProps } from './SplashVisual.types';

export function SplashFallback({ phase }: SplashVisualProps) {
  const insets = useSafeAreaInsets();
  const { reduceMotionEnabled, theme } = useAppTheme();
  const entrance = useSharedValue(phase === 'visible' ? 1 : 0);

  const isVisible = phase === 'visible';
  const targetValue = isVisible ? 1 : 0;

  useEffect(() => {
    entrance.value = withTiming(targetValue, {
      duration: reduceMotionEnabled
        ? theme.animations.duration.instant
        : theme.animations.duration.slow,
      easing: isVisible ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
    });
  }, [entrance, isVisible, reduceMotionEnabled, targetValue, theme]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [
      { translateY: interpolate(entrance.value, [0, 1], [theme.spacing.lg, 0]) },
      { scale: interpolate(entrance.value, [0, 1], [0.96, 1]) },
    ],
  }));

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.colors.background,
          paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
          paddingTop: Math.max(insets.top, theme.spacing.lg),
        },
      ]}
    >
      <Animated.View style={[styles.content, contentStyle]}>
        <AppLogo />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
