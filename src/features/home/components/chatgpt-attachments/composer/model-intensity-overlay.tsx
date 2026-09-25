import { ProgressiveBlurView } from 'expo-backdrop';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { findNodeHandle, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { OverKeyboardView } from 'react-native-keyboard-controller';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useAppTheme } from '@/theme';
import {
  NativeModelIntensitySlider,
  nativeModelIntensitySliderAvailable,
  type ModelIntensityStep,
} from 'native-model-intensity-slider';
import { COMPOSER, COMPOSER_STRIP_HEIGHT, GUTTER } from '../constants';

interface ModelIntensityOverlayProps {
  active: boolean;
  attachmentStripVisible: boolean;
  blocked: boolean;
  composerBottom: SharedValue<number>;
  mounted: boolean;
  originViewTag: number | null;
  screenHeight: number;
  screenWidth: number;
  selectedStep: ModelIntensityStep;
  strip: SharedValue<number>;
  onDismissRequest: () => void;
  onGeometryReady: (event: { nativeEvent: { ready: boolean } }) => void;
  onInteractionCommitted: (step: ModelIntensityStep) => void;
  onSelectedStepChange: (step: ModelIntensityStep) => void;
  onTransitionComplete: (expanded: boolean) => void;
}

const OVERLAY_GAP = 16;
const SLIDER_HEIGHT = 92;
const SLIDER_MAX_WIDTH = 320;
const BLUR_LAYOUT = {
  topLead: 16,
  fadeTail: 88,
  intensity: 22,
} as const;

export const ModelIntensityOverlay = memo(function ModelIntensityOverlay({
  active,
  attachmentStripVisible,
  blocked,
  composerBottom,
  mounted,
  originViewTag,
  screenHeight,
  screenWidth,
  selectedStep,
  strip,
  onDismissRequest,
  onGeometryReady,
  onInteractionCommitted,
  onSelectedStepChange,
  onTransitionComplete,
}: ModelIntensityOverlayProps) {
  const { resolvedMode, theme } = useAppTheme();
  const blurOpacity = useSharedValue(0);
  const targetViewRef = useRef<View>(null);
  const [targetViewTag, setTargetViewTag] = useState<number | undefined>();
  const [geometryRevision, setGeometryRevision] = useState(0);
  const sliderWidth = Math.min(screenWidth - GUTTER * 2, SLIDER_MAX_WIDTH);
  const blurStrongHeight =
    BLUR_LAYOUT.topLead +
    SLIDER_HEIGHT +
    OVERLAY_GAP +
    COMPOSER.rowHeight +
    (attachmentStripVisible ? COMPOSER_STRIP_HEIGHT : 0);
  const blurHeight = blurStrongHeight + BLUR_LAYOUT.fadeTail;
  const blurStartOffset = blurStrongHeight / blurHeight;

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
      OVERLAY_GAP -
      SLIDER_HEIGHT -
      BLUR_LAYOUT.topLead,
    height:
      BLUR_LAYOUT.topLead +
      SLIDER_HEIGHT +
      OVERLAY_GAP +
      COMPOSER.rowHeight +
      strip.get() * COMPOSER_STRIP_HEIGHT +
      BLUR_LAYOUT.fadeTail,
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

  const handleInteractionCommitted = useCallback(
    (event: { nativeEvent: { step: ModelIntensityStep } }) => {
      onInteractionCommitted(event.nativeEvent.step);
    },
    [onInteractionCommitted],
  );

  const handleNativeDismissRequest = useCallback(() => {
    onDismissRequest();
  }, [onDismissRequest]);

  const nativeSliderProps = {
    accentColor: theme.colors.primary,
    colorScheme: resolvedMode,
    expanded: active,
    geometryRevision,
    onDismissRequest: handleNativeDismissRequest,
    onGeometryReady,
    onInteractionCommitted: handleInteractionCommitted,
    onStepChange: handleStepChange,
    onTransitionComplete: handleTransitionComplete,
    originViewTag: originViewTag ?? undefined,
    selectedStep,
    testID: 'native-model-intensity-slider',
  };

  const handleTargetLayout = useCallback(() => {
    const tag = targetViewRef.current ? findNodeHandle(targetViewRef.current) : null;
    if (typeof tag === 'number') setTargetViewTag(tag);
    setGeometryRevision((revision) => revision + 1);
  }, []);

  useEffect(() => {
    if (!mounted || !nativeModelIntensitySliderAvailable) {
      setTargetViewTag(undefined);
      return;
    }

    handleTargetLayout();
  }, [handleTargetLayout, mounted]);

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
                edge="top"
                intensity={BLUR_LAYOUT.intensity}
                scrollFallback={false}
                startOffset={blurStartOffset}
                tint={
                  resolvedMode === 'dark'
                    ? 'systemUltraThinMaterialDark'
                    : 'systemUltraThinMaterialLight'
                }
                tintColor="transparent"
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>

          <Pressable
            accessible={false}
            onPress={onDismissRequest}
            pointerEvents={active ? 'auto' : 'none'}
            style={styles.dismissTarget}
            testID="model-intensity-dismiss-target"
          />

          {nativeModelIntensitySliderAvailable ? (
            <>
              <Animated.View style={[styles.sliderTargetPosition, sliderPositionStyle]}>
                <View
                  ref={targetViewRef}
                  collapsable={false}
                  onLayout={handleTargetLayout}
                  pointerEvents="none"
                  style={{ width: sliderWidth, height: SLIDER_HEIGHT }}
                  testID="model-intensity-target-frame"
                />
              </Animated.View>

              <NativeModelIntensitySlider
                {...nativeSliderProps}
                style={StyleSheet.absoluteFill}
                targetViewTag={targetViewTag}
              />
            </>
          ) : (
            <Animated.View
              pointerEvents="box-none"
              style={[styles.sliderTargetPosition, sliderPositionStyle]}
            >
              <NativeModelIntensitySlider
                {...nativeSliderProps}
                style={{ width: sliderWidth, height: SLIDER_HEIGHT }}
              />
            </Animated.View>
          )}
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
  },
  dismissTarget: StyleSheet.absoluteFill,
  sliderTargetPosition: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
