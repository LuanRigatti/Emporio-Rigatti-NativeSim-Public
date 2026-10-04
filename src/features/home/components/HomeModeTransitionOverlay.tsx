import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppLogo } from '@/components/branding/AppLogo';
import { useAppTheme } from '@/theme';

import type { HomeModeTransition } from '../hooks/useHomeModeTransition';

type HomeModeTransitionOverlayProps = {
  transition: HomeModeTransition;
  onCovered: (id: number) => void;
  onRevealed: (id: number) => void;
  onCancel: (id: number) => void;
};

// Keep these values aligned with the active SplashFallback animation.
const SPLASH_REVEAL_DURATION_MS = 1000;
const SPLASH_SYMBOL_CENTER_OFFSET = 37;
const SPLASH_REVEAL_TRAVEL = 26;
const HOME_MODE_REVEAL_DURATION_MS = 300;
// Both existing splash assets place the artwork's lower edge at about 52.8% of the image canvas.
const SPLASH_LOGO_ART_BOTTOM_RATIO = '52.8%';

export function HomeModeTransitionOverlay({
  transition: { id, phase, targetMode },
  onCovered,
  onRevealed,
  onCancel,
}: HomeModeTransitionOverlayProps) {
  const { theme } = useAppTheme();
  const entrance = useSharedValue(0);
  const overlayOpacity = useSharedValue(1);
  const [presented, setPresented] = useState(false);

  useEffect(() => {
    if (!presented || phase !== 'covering') return;

    entrance.value = withTiming(
      1,
      {
        duration: SPLASH_REVEAL_DURATION_MS,
        easing: Easing.inOut(Easing.cubic),
      },
      (finished) => {
        if (!finished) {
          runOnJS(onCancel)(id);
          return;
        }

        runOnJS(onCovered)(id);
      },
    );

    return () => cancelAnimation(entrance);
  }, [entrance, id, onCancel, onCovered, phase, presented]);

  useEffect(() => {
    if (!presented || phase !== 'revealing') return;

    overlayOpacity.value = withTiming(
      0,
      {
        duration: HOME_MODE_REVEAL_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (!finished) return;
        runOnJS(onRevealed)(id);
      },
    );

    return () => cancelAnimation(overlayOpacity);
  }, [id, onCancel, onRevealed, overlayOpacity, phase, presented]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: (1 - entrance.value) * SPLASH_REVEAL_TRAVEL }],
  }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  return (
    <Modal
      animationType="none"
      navigationBarTranslucent
      onRequestClose={() => undefined}
      onShow={() => setPresented(true)}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.root,
          { backgroundColor: theme.colors.background },
          overlayStyle,
        ]}
        testID="home-mode-transition-surface"
      >
        <View style={styles.centeredContent} testID="home-mode-transition-logo-position">
          <Animated.View
            style={[styles.content, contentStyle]}
            testID="home-mode-transition-composition"
          >
            <AppLogo size={540} variant="splash" />
            <View
              pointerEvents="none"
              style={[
                styles.modeLabel,
                { marginTop: theme.spacing.xl, top: SPLASH_LOGO_ART_BOTTOM_RATIO },
              ]}
              testID="home-mode-transition-target-label"
            >
              <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                {targetMode === 'wholesale' ? 'Atacado' : 'Varejo'}
              </Text>
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  centeredContent: {
    transform: [{ translateY: SPLASH_SYMBOL_CENTER_OFFSET }],
  },
  content: { alignItems: 'center', justifyContent: 'center' },
  modeLabel: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
