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
    resolvedMode === 'light'
      ? '#000000'
      : Platform.OS === 'ios'
        ? PlatformColor('placeholderText')
        : theme.colors.textSecondary;
  const [textWidth, setTextWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [shimmerProgress] = useState(() => new Animated.Value(0));
  const startedEntryKey = useRef<number | null>(null);

  const handleTextLayout = (event: TextLayoutEvent) => {
    const nextWidth = Math.ceil(event.nativeEvent.lines[0]?.width ?? 0);
    setTextWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
  };

  const handleOverlayLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.ceil(event.nativeEvent.layout.width);
    setContainerWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
  };

  useEffect(() => {
    shimmerProgress.stopAnimation();

    if (
      entryKey <= 0 ||
      textWidth <= 0 ||
      containerWidth <= 0 ||
      !visible ||
      reduceMotionEnabled ||
      startedEntryKey.current === entryKey
    ) {
      return undefined;
    }

    startedEntryKey.current = entryKey;
    shimmerProgress.setValue(0);

    const animation = Animated.timing(shimmerProgress, {
      duration: 2800,
      easing: Easing.inOut(Easing.quad),
      toValue: 1,
      useNativeDriver: true,
    });

    animation.start();

    return () => {
      animation.stop();
    };
  }, [containerWidth, entryKey, reduceMotionEnabled, shimmerProgress, textWidth, visible]);

  const waveWidth = Math.max(28, Math.round(textWidth * 0.4));
  const gradientColors: [ColorValue, ColorValue, ColorValue, ColorValue, ColorValue] =
    resolvedMode === 'dark'
      ? [
          'rgba(255,255,255,0)',
          'rgba(255,255,255,0.26)',
          'rgba(255,255,255,0.92)',
          'rgba(255,255,255,0.26)',
          'rgba(255,255,255,0)',
        ]
      : [
          'rgba(255,255,255,0)',
          theme.colors.borderStrong,
          theme.colors.borderStrong,
          theme.colors.borderStrong,
          'rgba(255,255,255,0)',
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
                style={[theme.typography.body, styles.searchText, styles.maskText, styles.shiftedText]}
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
                locations={[0, 0.32, 0.5, 0.68, 1]}
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
