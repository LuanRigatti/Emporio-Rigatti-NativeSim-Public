import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/theme';

export type PremiumLoadingProps = {
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export function Loading({ label, style }: PremiumLoadingProps) {
  const { theme, reduceMotionEnabled } = useAppTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotionEnabled) {
      opacity.value = 1;
      return undefined;
    }

    opacity.value = withRepeat(
      withTiming(theme.opacities.secondary, { duration: theme.animations.duration.slow }),
      -1,
      true,
    );
    return () => {
      opacity.value = 1;
    };
  }, [opacity, reduceMotionEnabled, theme.animations.duration.slow, theme.opacities.secondary]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityLabel={label ?? 'Carregando'}
      accessibilityRole="progressbar"
      style={[styles.container, { gap: theme.spacing.xs }, animatedStyle, style]}
    >
      <ActivityIndicator color={theme.colors.info} />
      {label ? (
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          {label}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flexDirection: 'row' },
});
