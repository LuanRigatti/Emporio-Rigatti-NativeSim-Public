import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/theme';

export type ShimmerProps = {
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
};

export function Shimmer({ animated = true, style }: ShimmerProps) {
  const { theme, reduceMotionEnabled } = useAppTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!animated || reduceMotionEnabled) {
      progress.value = 0;
      return undefined;
    }

    progress.value = withRepeat(
      withTiming(1, { duration: theme.animations.duration.slow }),
      -1,
      false,
    );
    return () => {
      progress.value = 0;
    };
  }, [animated, progress, reduceMotionEnabled, theme.animations.duration.slow]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reduceMotionEnabled ? theme.opacities.skeleton : 0.28 + progress.value * 0.32,
    transform: [{ translateX: progress.value * 120 }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.backgroundSecondary }, style]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.highlight, { backgroundColor: theme.colors.surfaceElevated }, animatedStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  highlight: { height: '100%', width: '42%' },
});
