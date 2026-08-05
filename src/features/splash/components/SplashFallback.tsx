import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppLogo } from '@/components/branding/AppLogo';

import type { SplashVisualProps } from './SplashVisual.types';

const SPLASH_REVEAL_DURATION_MS = 1000;
const SPLASH_SYMBOL_CENTER_OFFSET = 37;
const SPLASH_REVEAL_TRAVEL = 26;

export function SplashFallback({
  colorScheme,
  onOverlayReady,
  onAnimationComplete,
  startReveal,
}: SplashVisualProps) {
  const entrance = useSharedValue(0);

  useEffect(() => {
    onOverlayReady();
  }, [onOverlayReady]);

  useEffect(() => {
    const targetValue = startReveal ? 1 : 0;
    entrance.value = withTiming(
      targetValue,
      {
        duration: startReveal ? SPLASH_REVEAL_DURATION_MS : 0,
        easing: Easing.inOut(Easing.cubic),
      },
      (finished) => {
        if (finished && startReveal) {
          runOnJS(onAnimationComplete)();
        }
      },
    );
  }, [entrance, onAnimationComplete, startReveal]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: (1 - entrance.value) * SPLASH_REVEAL_TRAVEL }],
  }));

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colorScheme === 'dark' ? '#0B0F14' : '#FFFFFF',
        },
      ]}
    >
      <View style={styles.centeredContent}>
        <Animated.View style={[styles.content, contentStyle]}>
          <AppLogo size={540} variant="splash" />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  centeredContent: {
    transform: [{ translateY: SPLASH_SYMBOL_CENTER_OFFSET }],
  },
  content: { alignItems: 'center', justifyContent: 'center' },
});
