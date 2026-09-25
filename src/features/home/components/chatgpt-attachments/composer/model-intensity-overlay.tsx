import { ProgressiveBlurView } from 'expo-backdrop';
import { memo, useCallback, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { OverKeyboardView } from 'react-native-keyboard-controller';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useAppTheme } from '@/theme';
import { NativeModelIntensitySlider, type ModelIntensityStep } from 'native-model-intensity-slider';
import { COMPOSER, COMPOSER_STRIP_HEIGHT, GUTTER } from '../constants';

interface ModelIntensityOverlayProps {
  active: boolean;
  blocked: boolean;
  composerBottom: SharedValue<number>;
  mounted: boolean;
  screenHeight: number;
  screenWidth: number;
  selectedStep: ModelIntensityStep;
  strip: SharedValue<number>;
  onSelectedStepChange: (step: ModelIntensityStep) => void;
  onTransitionComplete: (expanded: boolean) => void;
}

const OVERLAY_GAP = 28;
const BLUR_PRELUDE = 260;
const BLUR_INTENSITY = 22;
const SLIDER_HEIGHT = 92;
const SLIDER_MAX_WIDTH = 320;

export const ModelIntensityOverlay = memo(function ModelIntensityOverlay({
  active,
  blocked,
  composerBottom,
  mounted,
  screenHeight,
  screenWidth,
  selectedStep,
  strip,
  onSelectedStepChange,
  onTransitionComplete,
}: ModelIntensityOverlayProps) {
  const { resolvedMode, theme } = useAppTheme();
  const blurOpacity = useSharedValue(0);
  const sliderWidth = Math.min(screenWidth - GUTTER * 2, SLIDER_MAX_WIDTH);

  useEffect(() => {
    if (blocked) {
      blurOpacity.set(0);
      return;
    }

    blurOpacity.set(withTiming(active ? 1 : 0, { duration: 220 }));
  }, [active, blocked, blurOpacity]);

  const backdropStyle = useAnimatedStyle(() => ({
    top:
      composerBottom.get() -
      strip.get() * COMPOSER_STRIP_HEIGHT -
      COMPOSER.rowHeight -
      BLUR_PRELUDE,
    opacity: blurOpacity.get(),
  }));

  const sliderPositionStyle = useAnimatedStyle(() => ({
    bottom:
      screenHeight -
      composerBottom.get() +
      strip.get() * COMPOSER_STRIP_HEIGHT +
      COMPOSER.rowHeight +
      OVERLAY_GAP,
  }));

  const handleStepChange = useCallback(
    (event: { nativeEvent: { step: ModelIntensityStep } }) => {
      onSelectedStepChange(event.nativeEvent.step);
    },
    [onSelectedStepChange],
  );

  const handleTransitionComplete = useCallback(
    (event: { nativeEvent: { expanded: boolean } }) => {
      onTransitionComplete(event.nativeEvent.expanded);
    },
    [onTransitionComplete],
  );

  return (
    <OverKeyboardView visible={mounted && !blocked}>
      {mounted && !blocked ? (
        <View pointerEvents="box-none" style={styles.root} testID="model-intensity-overlay">
          <View pointerEvents="none" style={styles.backdropRoot}>
            <ScrollView
              contentContainerStyle={{ height: screenHeight * 3 }}
              contentOffset={{ x: 0, y: screenHeight }}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              style={styles.scrollAnchor}
            />
            <Animated.View pointerEvents="none" style={[styles.backdrop, backdropStyle]}>
              <ProgressiveBlurView
                edge="bottom"
                intensity={BLUR_INTENSITY}
                scrollFallback={false}
                tint={
                  resolvedMode === 'dark'
                    ? 'systemUltraThinMaterialDark'
                    : 'systemUltraThinMaterialLight'
                }
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>

          <Animated.View
            pointerEvents={active ? 'box-none' : 'none'}
            style={[styles.sliderPosition, sliderPositionStyle]}
          >
            <NativeModelIntensitySlider
              accentColor={theme.colors.primary}
              colorScheme={resolvedMode}
              expanded={active}
              onStepChange={handleStepChange}
              onTransitionComplete={handleTransitionComplete}
              selectedStep={selectedStep}
              style={{ width: sliderWidth, height: SLIDER_HEIGHT }}
              testID="native-model-intensity-slider"
            />
          </Animated.View>
        </View>
      ) : null}
    </OverKeyboardView>
  );
});

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill },
  backdropRoot: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  scrollAnchor: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sliderPosition: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
