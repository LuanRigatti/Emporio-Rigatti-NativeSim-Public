import MaskedView from '@react-native-masked-view/masked-view';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  PlatformColor,
  StyleSheet,
  Text,
  View,
  type ColorValue,
  type LayoutChangeEvent,
  type TextLayoutEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppTheme } from '@/theme';

type NativeSearchPlaceholderShimmerProps = {
  entryKey: number;
  placeholder: string;
  visible: boolean;
};

const HSTACK_HORIZONTAL_PADDING = 12;
const SEARCH_ICON_SIZE = 18;
const HSTACK_SPACING = 20;
const SEARCH_TEXT_SIZE = 18;
const PLACEHOLDER_LINE_HEIGHT = 23;
const PLACEHOLDER_TEXT_SHIFT = -16;
const PLACEHOLDER_LEFT = HSTACK_HORIZONTAL_PADDING + SEARCH_ICON_SIZE + HSTACK_SPACING;
const PLACEHOLDER_HEIGHT = PLACEHOLDER_LINE_HEIGHT;

export default function NativeSearchPlaceholderShimmer({
  entryKey,
  placeholder,
  visible,
}: NativeSearchPlaceholderShimmerProps) {
  const { reduceMotionEnabled, resolvedMode, theme } = useAppTheme();
  const placeholderColor =
    Platform.OS === 'ios' ? PlatformColor('placeholderText') : theme.colors.textSecondary;
  const [textWidth, setTextWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [shimmerProgress] = useState(() => new Animated.Value(0));
  const wasVisibleRef = useRef(false);
  const hasAnimatedForCurrentVisibilityRef = useRef(false);
  const lastEntryKeyRef = useRef(entryKey);
  const activeAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const handleTextLayout = (event: TextLayoutEvent) => {
    const nextWidth = Math.ceil(event.nativeEvent.lines[0]?.width ?? 0);
    setTextWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
  };

  const handleOverlayLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.ceil(event.nativeEvent.layout.width);
    setContainerWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
  };

  useEffect(() => {
    if (!visible || reduceMotionEnabled) {
      if (activeAnimationRef.current) {
        activeAnimationRef.current.stop();
        activeAnimationRef.current = null;
      }
      shimmerProgress.setValue(0);
      wasVisibleRef.current = false;
      hasAnimatedForCurrentVisibilityRef.current = false;
      return undefined;
    }

    if (!wasVisibleRef.current || lastEntryKeyRef.current !== entryKey) {
      wasVisibleRef.current = true;
      lastEntryKeyRef.current = entryKey;
      hasAnimatedForCurrentVisibilityRef.current = false;
    }

    if (textWidth <= 0 || containerWidth <= 0) {
      return undefined;
    }

    if (!hasAnimatedForCurrentVisibilityRef.current) {
      hasAnimatedForCurrentVisibilityRef.current = true;

      if (activeAnimationRef.current) {
        activeAnimationRef.current.stop();
      }

      shimmerProgress.setValue(0);

      const animation = Animated.timing(shimmerProgress, {
        duration: 2800,
        easing: Easing.inOut(Easing.quad),
        toValue: 1,
        useNativeDriver: true,
      });

      activeAnimationRef.current = animation;

      animation.start(({ finished }) => {
        if (finished) {
          activeAnimationRef.current = null;
        }
      });
    }

    return () => {
      if (activeAnimationRef.current) {
        activeAnimationRef.current.stop();
        activeAnimationRef.current = null;
      }
    };
  }, [containerWidth, entryKey, reduceMotionEnabled, shimmerProgress, textWidth, visible]);

  const waveWidth = Math.max(64, Math.round(textWidth * 0.75));
  const gradientColors: [
    ColorValue,
    ColorValue,
    ColorValue,
    ColorValue,
    ColorValue,
    ColorValue,
    ColorValue,
    ColorValue,
    ColorValue,
  ] =
    resolvedMode === 'dark'
      ? [
          'rgba(255,255,255,0)',
          'rgba(180,185,195,0.18)',
          'rgba(215,222,230,0.45)',
          'rgba(240,245,250,0.72)',
          'rgba(255,255,255,0.82)',
          'rgba(240,245,250,0.72)',
          'rgba(215,222,230,0.45)',
          'rgba(180,185,195,0.18)',
          'rgba(255,255,255,0)',
        ]
      : [
          'rgba(0,0,0,0)',
          'rgba(100,110,125,0.25)',
          'rgba(60,70,85,0.55)',
          'rgba(35,42,56,0.75)',
          'rgba(25,30,42,0.85)',
          'rgba(35,42,56,0.75)',
          'rgba(60,70,85,0.55)',
          'rgba(100,110,125,0.25)',
          'rgba(0,0,0,0)',
        ];
  const translateX = shimmerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-waveWidth, containerWidth + waveWidth],
  });
  if (!visible) {
    return null;
  }

  return (
    <View onLayout={handleOverlayLayout} pointerEvents="none" style={styles.overlay}>
      <View style={styles.textLayer}>
        <Text
          numberOfLines={1}
          onTextLayout={handleTextLayout}
          style={[theme.typography.body, styles.searchText, styles.baseText, styles.measureText]}
        >
          {placeholder}
        </Text>

        <Text
          numberOfLines={1}
          style={[
            theme.typography.body,
            styles.searchText,
            styles.baseText,
            styles.staticText,
            styles.shiftedText,
            { color: placeholderColor },
          ]}
        >
          {placeholder}
        </Text>

        {visible && textWidth > 0 && containerWidth > 0 && !reduceMotionEnabled ? (
          <MaskedView
            pointerEvents="none"
            style={[styles.mask, { height: PLACEHOLDER_HEIGHT, width: containerWidth }]}
            maskElement={
              <Text
                numberOfLines={1}
                style={[
                  theme.typography.body,
                  styles.searchText,
                  styles.maskText,
                  styles.shiftedText,
                ]}
              >
                {placeholder}
              </Text>
            }
          >
            <Animated.View
              style={[
                styles.gradientTrack,
                {
                  height: PLACEHOLDER_HEIGHT,
                  transform: [{ translateX }],
                  width: waveWidth,
                },
              ]}
            >
              <LinearGradient
                colors={gradientColors}
                end={{ x: 1, y: 0.5 }}
                locations={[0, 0.14, 0.28, 0.4, 0.5, 0.6, 0.72, 0.86, 1]}
                start={{ x: 0, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </MaskedView>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    bottom: 0,
    left: PLACEHOLDER_LEFT,
    overflow: 'hidden',
    position: 'absolute',
    right: 12,
    top: 0,
    justifyContent: 'center',
  },
  textLayer: {
    alignItems: 'flex-start',
    height: PLACEHOLDER_HEIGHT,
    position: 'relative',
    width: '100%',
  },
  searchText: {
    fontSize: SEARCH_TEXT_SIZE,
    lineHeight: PLACEHOLDER_LINE_HEIGHT,
  },
  measureText: {
    color: 'transparent',
    height: PLACEHOLDER_HEIGHT,
    left: 0,
    opacity: 0,
    position: 'absolute',
    top: 0,
  },
  baseText: {
    height: PLACEHOLDER_HEIGHT,
    left: 0,
    lineHeight: PLACEHOLDER_LINE_HEIGHT,
    position: 'absolute',
    top: 0,
  },
  mask: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  staticText: {
    opacity: 1,
    textAlign: 'center',
    width: '100%',
  },
  shiftedText: {
    transform: [{ translateX: PLACEHOLDER_TEXT_SHIFT }],
  },
  maskText: {
    color: '#000',
    height: PLACEHOLDER_HEIGHT,
    textAlign: 'center',
    width: '100%',
  },
  gradientTrack: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
});
