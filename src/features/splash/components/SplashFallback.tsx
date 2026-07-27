import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
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

import type { SplashVisualProps } from './SplashVisual.types';

export function SplashFallback({ phase }: SplashVisualProps) {
  const insets = useSafeAreaInsets();
  const { reduceMotionEnabled, resolvedMode, theme } = useAppTheme();
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
      <View
        pointerEvents="none"
        style={[
          styles.orb,
          styles.orbTop,
          {
            backgroundColor: theme.colors.brand,
            opacity: resolvedMode === 'dark' ? 0.16 : 0.32,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.orb,
          styles.orbBottom,
          {
            backgroundColor: theme.colors.primary,
            opacity: resolvedMode === 'dark' ? 0.08 : 0.06,
          },
        ]}
      />

      <Animated.View style={[styles.content, contentStyle]}>
        <View
          style={[
            styles.logoSurface,
            {
              backgroundColor: theme.colors.brand,
              borderColor: theme.colors.glassBorder,
              borderRadius: theme.radius.xl,
            },
          ]}
        >
          <Ionicons
            color={theme.colors.brandStrong}
            name="water"
            size={theme.sizes.iconLarge + 12}
          />
        </View>
        <Text
          style={[theme.typography.largeTitle, styles.appName, { color: theme.colors.textPrimary }]}
        >
          PAReact
        </Text>
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
  logoSurface: {
    alignItems: 'center',
    borderWidth: 1,
    height: 104,
    justifyContent: 'center',
    width: 104,
  },
  appName: {
    marginTop: 22,
  },
  orb: {
    borderRadius: 240,
    height: 240,
    position: 'absolute',
    width: 240,
  },
  orbTop: {
    right: -92,
    top: -80,
  },
  orbBottom: {
    bottom: -96,
    left: -92,
  },
});
