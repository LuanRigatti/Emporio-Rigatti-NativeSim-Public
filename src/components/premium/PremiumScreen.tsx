import { useIsFocused } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ColorValue,
  type LayoutChangeEvent,
  type ScrollViewProps,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProgressiveBlur } from '@/components/ui/progressive-blur';
import { ENABLE_PROGRESSIVE_BLUR } from '@/config/featureFlags';
import { useAppTheme } from '@/theme';
import { logStartupDiagnostics, useStartupDiagnostics } from '@/utils/startupLayoutDiagnostics';

export type PremiumScreenProps = ViewProps & {
  children: ReactNode;
  overlayBackground?: ReactNode;
  overlayHeader?: ReactNode;
  overlayHeaderContentOffset?: number;
  overlayHeaderSafeArea?: boolean;
  overlayHeaderSpacing?: number;
  overlayHeaderTopSpacing?: number;
  overlayHeaderUnderlay?: boolean;
  onOverlayHeaderLayout?: (height: number) => void;
  progressiveBlurHeight?: number;
  progressiveBlurFadeStart?: number;
  progressiveBlurIntensity?: number;
  progressiveBlurOverlayColors?: readonly [ColorValue, ColorValue, ColorValue] | null;
  progressiveBlurTopOffset?: number;
  progressiveBlur?: boolean;
  scrollable?: boolean;
  startupDiagnosticsLabel?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollViewProps?: Omit<ScrollViewProps, 'contentContainerStyle'>;
};

export function PremiumScreen({
  children,
  overlayBackground,
  overlayHeader,
  overlayHeaderContentOffset = 0,
  overlayHeaderSafeArea = false,
  overlayHeaderSpacing = 0,
  overlayHeaderTopSpacing = 0,
  overlayHeaderUnderlay = false,
  onOverlayHeaderLayout,
  progressiveBlurHeight,
  progressiveBlurFadeStart,
  progressiveBlurIntensity,
  progressiveBlurOverlayColors,
  progressiveBlurTopOffset = 0,
  progressiveBlur = false,
  scrollable = true,
  startupDiagnosticsLabel,
  contentContainerStyle,
  scrollViewProps,
  onLayout: rootOnLayout,
  style,
  ...props
}: PremiumScreenProps) {
  const { resolvedMode, theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [overlayHeaderHeight, setOverlayHeaderHeight] = useState(0);
  const effectiveOverlayHeaderHeight =
    overlayHeaderHeight || insets.top + theme.sizes.touchTargetMinimum;
  const overlayHeaderTopOffset = overlayHeaderSafeArea ? insets.top + overlayHeaderTopSpacing : 0;
  const overlayHeaderTotalHeight = effectiveOverlayHeaderHeight + overlayHeaderTopOffset;
  const shouldRenderProgressiveBlur =
    progressiveBlur && ENABLE_PROGRESSIVE_BLUR && Platform.OS === 'ios';
  const resolvedProgressiveBlurHeight =
    progressiveBlurHeight ?? insets.top + theme.spacing.xxxl + theme.spacing.xs * 2;
  const overlayContentPaddingTop = Math.max(
    0,
    overlayHeaderUnderlay
      ? 0
      : overlayHeaderTotalHeight + overlayHeaderSpacing - overlayHeaderContentOffset,
  );
  const diagnosticsComponent = startupDiagnosticsLabel
    ? `PremiumScreen.${startupDiagnosticsLabel}`
    : 'PremiumScreen';

  useStartupDiagnostics(diagnosticsComponent, {
    effectiveOverlayHeaderHeight,
    insetsBottom: insets.bottom,
    insetsTop: insets.top,
    isFocused,
    overlayHeaderHeight,
    overlayHeaderTopOffset,
    overlayHeaderTotalHeight,
    overlayContentPaddingTop,
    overlayHeaderUnderlay,
    paddingTop: overlayHeader && !overlayHeaderUnderlay ? 0 : insets.top,
  });

  const handleRootLayout = (event: LayoutChangeEvent) => {
    rootOnLayout?.(event);
    logStartupDiagnostics(diagnosticsComponent, 'root-layout', {
      frame: event.nativeEvent.layout,
    });
  };
  const handleScrollViewLayout = (event: LayoutChangeEvent) => {
    scrollViewProps?.onLayout?.(event);
    logStartupDiagnostics(`${diagnosticsComponent}.scrollView`, 'layout', {
      frame: event.nativeEvent.layout,
    });
  };
  const handleContentLayout = (event: LayoutChangeEvent) => {
    logStartupDiagnostics(`${diagnosticsComponent}.content`, 'layout', {
      frame: event.nativeEvent.layout,
    });
  };
  const contentStyle = [
    styles.content,
    {
      paddingHorizontal: theme.layout.screenHorizontalPadding,
      paddingBottom: theme.spacing.xxxl,
    },
    contentContainerStyle,
  ];

  return (
    <View
      {...props}
      onLayout={handleRootLayout}
      style={[
        styles.safeArea,
        {
          backgroundColor: theme.colors.background,
          paddingTop: overlayHeader && !overlayHeaderUnderlay ? 0 : insets.top,
        },
        style,
      ]}
    >
      {scrollable ? (
        <ScrollView
          {...scrollViewProps}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={[
            contentStyle,
            overlayHeader ? { paddingTop: overlayContentPaddingTop } : undefined,
          ]}
          keyboardShouldPersistTaps="handled"
          onLayout={handleScrollViewLayout}
          showsVerticalScrollIndicator={false}
          style={{ overflow: 'visible' }}
        >
          {children}
        </ScrollView>
      ) : (
        <View
          onLayout={handleContentLayout}
          style={[
            contentStyle,
            overlayHeader ? { paddingTop: overlayContentPaddingTop } : undefined,
          ]}
        >
          {children}
        </View>
      )}
      {overlayBackground}
      {shouldRenderProgressiveBlur ? (
        <ProgressiveBlur
          edge="top"
          fadeStart={
            progressiveBlurFadeStart ??
            Math.max(0, insets.top - (theme.spacing.xxxl + theme.spacing.xs * 2))
          }
          height={resolvedProgressiveBlurHeight}
          intensity={progressiveBlurIntensity ?? 30}
          layers={4}
          overlayColors={
            progressiveBlurOverlayColors === undefined
              ? resolvedMode === 'dark'
                ? [theme.colors.background, theme.colors.background, 'transparent']
                : null
              : progressiveBlurOverlayColors
          }
          style={{ top: progressiveBlurTopOffset, zIndex: 1 }}
          tint={resolvedMode === 'dark' ? 'systemChromeMaterialDark' : 'systemUltraThinMaterial'}
        />
      ) : null}
      {overlayHeader ? (
        <View
          onLayout={(event) => {
            const height = event.nativeEvent.layout.height;
            logStartupDiagnostics(`${diagnosticsComponent}.overlayHeader`, 'layout', {
              frame: event.nativeEvent.layout,
              measuredHeight: height,
            });
            setOverlayHeaderHeight(height);
            onOverlayHeaderLayout?.(height);
          }}
          pointerEvents="box-none"
          style={[styles.overlayHeader, { top: overlayHeaderTopOffset }]}
        >
          {overlayHeader}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1 },
  overlayHeader: {
    left: 0,
    overflow: 'visible',
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
});
