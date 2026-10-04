import { useCallback, useState, type ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ColorValue,
  type ScrollViewProps,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { NativeGlassHeaderCollapsibleTitleContext } from '@/components/layout/NativeGlassHeader/NativeGlassHeaderCollapsibleTitleContext';
import { ProgressiveBlur } from '@/components/ui/progressive-blur';
import { ENABLE_PROGRESSIVE_BLUR } from '@/config/featureFlags';
import { PREMIUM_TITLE_ACCESSIBILITY_SWITCH_AT } from '@/components/premium/PremiumScreenCollapsibleTitleConstants';
import { useAppTheme } from '@/theme';
import { useAppSafeAreaInsets } from '@/providers';

export type PremiumScreenCollapsibleTitle = {
  compactTitle: ReactNode;
};

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
  collapsibleTitle?: PremiumScreenCollapsibleTitle;
  scrollable?: boolean;
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
  collapsibleTitle,
  scrollable = true,
  contentContainerStyle,
  scrollViewProps,
  onLayout: rootOnLayout,
  style,
  ...props
}: PremiumScreenProps) {
  const { resolvedMode, theme, reduceMotionEnabled } = useAppTheme();
  const insets = useAppSafeAreaInsets();
  const [overlayHeaderHeight, setOverlayHeaderHeight] = useState(0);
  const [compactTitleActive, setCompactTitleActive] = useState(false);
  const scrollY = useSharedValue(0);
  const onScroll = scrollViewProps?.onScroll;
  const forwardExternalScrollEvent = useCallback(
    (nativeEvent: NativeScrollEvent) => {
      if (!onScroll) return;

      onScroll({
        bubbles: false,
        cancelable: false,
        currentTarget: 0,
        defaultPrevented: false,
        eventPhase: 0,
        isDefaultPrevented: () => false,
        isPropagationStopped: () => false,
        isTrusted: true,
        nativeEvent,
        persist: () => undefined,
        preventDefault: () => undefined,
        stopPropagation: () => undefined,
        target: 0,
        timeStamp: Date.now(),
        type: 'scroll',
      } as unknown as NativeSyntheticEvent<NativeScrollEvent>);
    },
    [onScroll],
  );
  const hasCollapsibleTitle = Boolean(collapsibleTitle);
  const hasExternalOnScroll = Boolean(onScroll);
  const collapsibleScrollHandler = useAnimatedScrollHandler(
    (event) => {
      scrollY.value = Math.max(0, event.contentOffset.y);

      if (hasExternalOnScroll) {
        runOnJS(forwardExternalScrollEvent)(event as unknown as NativeScrollEvent);
      }
    },
    [forwardExternalScrollEvent, hasExternalOnScroll],
  );

  useAnimatedReaction(
    () => scrollY.value >= PREMIUM_TITLE_ACCESSIBILITY_SWITCH_AT,
    (nextCompactTitleActive, previousCompactTitleActive) => {
      if (!hasCollapsibleTitle || nextCompactTitleActive === previousCompactTitleActive) {
        return;
      }

      runOnJS(setCompactTitleActive)(nextCompactTitleActive);
    },
    [hasCollapsibleTitle],
  );
  const effectiveOverlayHeaderHeight =
    overlayHeaderHeight || insets.top + theme.sizes.touchTargetMinimum;
  const overlayHeaderTopOffset = overlayHeaderSafeArea ? insets.top + overlayHeaderTopSpacing : 0;
  const overlayHeaderTotalHeight = effectiveOverlayHeaderHeight + overlayHeaderTopOffset;
  const shouldRenderProgressiveBlur =
    progressiveBlur && ENABLE_PROGRESSIVE_BLUR && Platform.OS === 'ios';
  const defaultProgressiveBlurHeight =
    progressiveBlurHeight ?? insets.top + theme.spacing.xxxl + theme.spacing.xs * 2;
  const collapsibleTitleBlurTail = theme.spacing.xxl + theme.spacing.xs * 2;
  const usesCustomProgressiveBlurOffset = progressiveBlurTopOffset !== 0;
  const shouldExtendProgressiveBlurForCompactHeader =
    shouldRenderProgressiveBlur && hasCollapsibleTitle && !usesCustomProgressiveBlurOffset;
  const resolvedProgressiveBlurHeight = shouldExtendProgressiveBlurForCompactHeader
    ? Math.max(
        defaultProgressiveBlurHeight,
        overlayHeaderTotalHeight + collapsibleTitleBlurTail - progressiveBlurTopOffset,
      )
    : defaultProgressiveBlurHeight;
  const bottomScrollSpace = theme.layout.tabBarHeight + insets.bottom + theme.spacing.lg;
  const overlayContentPaddingTop = Math.max(
    0,
    overlayHeaderUnderlay
      ? 0
      : overlayHeaderTotalHeight + overlayHeaderSpacing - overlayHeaderContentOffset,
  );
  const contentStyle = [
    styles.content,
    {
      paddingHorizontal: theme.layout.screenHorizontalPadding,
      paddingBottom: bottomScrollSpace,
    },
    contentContainerStyle,
  ];
  const scrollIndicatorInsets = {
    ...scrollViewProps?.scrollIndicatorInsets,
    bottom: Math.max(scrollViewProps?.scrollIndicatorInsets?.bottom ?? 0, bottomScrollSpace),
  };

  const screen = (
    <View
      {...props}
      onLayout={rootOnLayout}
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
        hasCollapsibleTitle ? (
          <Animated.ScrollView
            {...scrollViewProps}
            automaticallyAdjustContentInsets={false}
            contentInsetAdjustmentBehavior="never"
            contentContainerStyle={[
              contentStyle,
              overlayHeader ? { paddingTop: overlayContentPaddingTop } : undefined,
            ]}
            keyboardShouldPersistTaps="handled"
            onLayout={scrollViewProps?.onLayout}
            onScroll={collapsibleScrollHandler}
            scrollEventThrottle={scrollViewProps?.scrollEventThrottle ?? 16}
            scrollIndicatorInsets={scrollIndicatorInsets}
            showsVerticalScrollIndicator={false}
            style={{ overflow: 'visible' }}
          >
            {children}
          </Animated.ScrollView>
        ) : (
          <ScrollView
            {...scrollViewProps}
            automaticallyAdjustContentInsets={false}
            contentInsetAdjustmentBehavior="never"
            contentContainerStyle={[
              contentStyle,
              overlayHeader ? { paddingTop: overlayContentPaddingTop } : undefined,
            ]}
            keyboardShouldPersistTaps="handled"
            onLayout={scrollViewProps?.onLayout}
            scrollIndicatorInsets={scrollIndicatorInsets}
            showsVerticalScrollIndicator={false}
            style={{ overflow: 'visible' }}
          >
            {children}
          </ScrollView>
        )
      ) : (
        <View
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

  return collapsibleTitle ? (
    <NativeGlassHeaderCollapsibleTitleContext.Provider
      value={{
        compactTitle: collapsibleTitle.compactTitle,
        compactTitleActive,
        reduceMotionEnabled,
        scrollY,
      }}
    >
      {screen}
    </NativeGlassHeaderCollapsibleTitleContext.Provider>
  ) : (
    screen
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
