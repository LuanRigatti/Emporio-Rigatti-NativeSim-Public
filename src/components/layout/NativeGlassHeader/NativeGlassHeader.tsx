import { useContext, type ReactNode } from 'react';
import { BlurView } from 'expo-blur';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type TextStyle,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
} from 'react-native-reanimated';
import {
  PREMIUM_TITLE_ACCESSIBILITY_SWITCH_AT,
  PREMIUM_TITLE_COMPACT_BLUR_MAX_INTENSITY,
  PREMIUM_TITLE_COMPACT_BLUR_RANGE,
  PREMIUM_TITLE_COMPACT_FADE_RANGE,
  PREMIUM_TITLE_COMPACT_TRANSLATE_Y,
  PREMIUM_TITLE_LARGE_FADE_RANGE,
} from '@/components/premium/PremiumScreenCollapsibleTitleConstants';
import { ProgressiveBlurMask } from '@/components/ui/progressive-blur';
import { useAppTheme } from '@/theme';
import { useAppSafeAreaInsets } from '@/providers';

import { NativeGlassHeaderCollapsibleTitleContext } from './NativeGlassHeaderCollapsibleTitleContext';
import NativeGlassHeaderBackground from './NativeGlassHeaderBackground';
import type {
  NativeGlassHeaderCollapsibleTitleRole,
  NativeGlassHeaderProps,
} from './NativeGlassHeader.types';

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

type AnimatedTitleContentProps = {
  children: ReactNode;
  role: NativeGlassHeaderCollapsibleTitleRole;
};

type AnimatedCompactHeaderBlurProps = {
  horizontalInset: number;
  scrollY: SharedValue<number>;
  tint: 'systemChromeMaterialDark' | 'systemUltraThinMaterial';
};

function AnimatedCompactHeaderBlur({
  horizontalInset,
  scrollY,
  tint,
}: AnimatedCompactHeaderBlurProps) {
  const animatedProps = useAnimatedProps(
    () => ({
      intensity: interpolate(
        scrollY.value,
        PREMIUM_TITLE_COMPACT_BLUR_RANGE,
        [PREMIUM_TITLE_COMPACT_BLUR_MAX_INTENSITY, 0],
        Extrapolation.CLAMP,
      ),
    }),
    [scrollY],
  );

  return (
    <ProgressiveBlurMask
      colors={['#000000', '#000000', 'rgba(0, 0, 0, 0.18)', 'transparent', 'transparent']}
      locations={[0, 0.56, 0.76, 0.96, 1]}
      style={[
        StyleSheet.absoluteFill,
        styles.compactHeaderBlur,
        { left: -horizontalInset, right: -horizontalInset },
      ]}
    >
      <AnimatedBlurView
        accessible={false}
        animatedProps={animatedProps}
        intensity={0}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        tint={tint}
      />
    </ProgressiveBlurMask>
  );
}

function AnimatedTitleContent({ children, role }: AnimatedTitleContentProps) {
  const context = useContext(NativeGlassHeaderCollapsibleTitleContext);
  const scrollY = context?.scrollY;
  const reduceMotionEnabled = context?.reduceMotionEnabled ?? false;
  const isVisible = context
    ? role === 'large'
      ? !context.compactTitleActive
      : context.compactTitleActive
    : true;
  const animatedStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 1 };

    const offset = scrollY.value;
    if (reduceMotionEnabled) {
      const visible =
        role === 'large'
          ? offset < PREMIUM_TITLE_ACCESSIBILITY_SWITCH_AT
          : offset >= PREMIUM_TITLE_ACCESSIBILITY_SWITCH_AT;
      return { opacity: visible ? 1 : 0 };
    }

    if (role === 'large') {
      return {
        opacity: interpolate(offset, PREMIUM_TITLE_LARGE_FADE_RANGE, [1, 0], Extrapolation.CLAMP),
      };
    }

    return {
      opacity: interpolate(offset, PREMIUM_TITLE_COMPACT_FADE_RANGE, [0, 1], Extrapolation.CLAMP),
      transform: [
        {
          translateY: interpolate(
            offset,
            PREMIUM_TITLE_COMPACT_FADE_RANGE,
            [PREMIUM_TITLE_COMPACT_TRANSLATE_Y, 0],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  }, [reduceMotionEnabled, role, scrollY]);

  return (
    <Animated.View
      accessibilityElementsHidden={!isVisible}
      importantForAccessibility={isVisible ? 'auto' : 'no-hide-descendants'}
      pointerEvents={isVisible ? 'auto' : 'none'}
      style={[styles.animatedTitle, animatedStyle]}
    >
      {children}
    </Animated.View>
  );
}

export function getNativeLargeTitleStyle(spacingXxs: number): TextStyle {
  return {
    fontFamily: 'System',
    fontSize: 36,
    fontWeight: '700',
    marginLeft: -(spacingXxs * 2),
  };
}

export function NativeGlassHeader({
  accessory,
  collapsibleTitleRole,
  includeTopSafeArea = true,
  largeTitle = false,
  leftActions,
  mode = 'translucent',
  onLayout,
  pointerEvents,
  rightActions,
  search,
  segmentedControl,
  style,
  subtitle,
  title,
  titleStyle: customTitleStyle,
}: NativeGlassHeaderProps) {
  const insets = useAppSafeAreaInsets();
  const { resolvedMode, theme } = useAppTheme();
  const collapsibleTitleContext = useContext(NativeGlassHeaderCollapsibleTitleContext);
  const scrollY = collapsibleTitleContext?.scrollY;
  const reduceMotionEnabled = collapsibleTitleContext?.reduceMotionEnabled ?? false;
  const resolvedTitleStyle = largeTitle ? theme.typography.largeTitle : theme.typography.headline;
  const resolvedTitle =
    collapsibleTitleRole === 'compact' && collapsibleTitleContext
      ? collapsibleTitleContext.compactTitle
      : title;
  const titleContent = (
    <>
      {typeof resolvedTitle === 'string' || typeof resolvedTitle === 'number' ? (
        <Text
          numberOfLines={1}
          style={[
            resolvedTitleStyle,
            customTitleStyle,
            { color: theme.colors.textPrimary },
            largeTitle && styles.largeTitle,
          ]}
        >
          {resolvedTitle}
        </Text>
      ) : (
        resolvedTitle
      )}
      {subtitle ? (
        <Text
          numberOfLines={1}
          style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
        >
          {subtitle}
        </Text>
      ) : null}
    </>
  );
  const animatedRole = collapsibleTitleContext ? collapsibleTitleRole : undefined;
  const shouldRenderCompactHeaderBlur =
    animatedRole === 'compact' && !reduceMotionEnabled && Boolean(scrollY) && Platform.OS === 'ios';
  const compactHeaderSafeAreaInset =
    shouldRenderCompactHeaderBlur && includeTopSafeArea ? insets.top : 0;
  const collapsibleTitleBlurTint =
    resolvedMode === 'dark' ? 'systemChromeMaterialDark' : 'systemUltraThinMaterial';

  const handleLayout = (event: LayoutChangeEvent) => {
    onLayout?.(event);
  };

  return (
    <View
      onLayout={handleLayout}
      pointerEvents={pointerEvents ?? (animatedRole === 'compact' ? 'box-none' : undefined)}
      style={[
        styles.container,
        {
          paddingHorizontal: theme.layout.screenHorizontalPadding,
          paddingTop: includeTopSafeArea && compactHeaderSafeAreaInset === 0 ? insets.top : 0,
        },
        mode === 'floating' ? styles.floating : undefined,
        style,
      ]}
    >
      <NativeGlassHeaderBackground mode={mode} />
      <View
        style={[
          styles.topRow,
          {
            minHeight: theme.sizes.touchTargetMinimum + compactHeaderSafeAreaInset,
            paddingTop: compactHeaderSafeAreaInset,
          },
        ]}
      >
        <View
          style={[
            styles.actions,
            shouldRenderCompactHeaderBlur ? styles.actionsAboveCompactHeaderBlur : undefined,
            { minWidth: largeTitle && !leftActions ? 0 : theme.sizes.touchTargetMinimum },
          ]}
        >
          {leftActions}
        </View>
        <View style={[styles.titleContainer, largeTitle ? styles.largeTitleContainer : undefined]}>
          {animatedRole ? (
            <AnimatedTitleContent role={animatedRole}>{titleContent}</AnimatedTitleContent>
          ) : (
            titleContent
          )}
        </View>
        <View
          style={[
            styles.actions,
            styles.trailingActions,
            shouldRenderCompactHeaderBlur ? styles.actionsAboveCompactHeaderBlur : undefined,
            { minWidth: largeTitle && !rightActions ? 0 : theme.sizes.touchTargetMinimum },
          ]}
        >
          {rightActions}
        </View>
        {shouldRenderCompactHeaderBlur && scrollY ? (
          <AnimatedCompactHeaderBlur
            horizontalInset={theme.layout.screenHorizontalPadding}
            scrollY={scrollY}
            tint={collapsibleTitleBlurTint}
          />
        ) : null}
      </View>
      {search}
      {segmentedControl}
      {accessory}
    </View>
  );
}

const styles = StyleSheet.create({
  animatedTitle: {
    position: 'relative',
  },
  container: {
    overflow: 'visible',
    position: 'relative',
    width: '100%',
  },
  floating: {
    zIndex: 2,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    position: 'relative',
  },
  compactHeaderBlur: {
    zIndex: 1,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  actionsAboveCompactHeaderBlur: {
    zIndex: 2,
  },
  trailingActions: {
    justifyContent: 'flex-end',
  },
  titleContainer: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  largeTitleContainer: {
    alignItems: 'flex-start',
    paddingHorizontal: 0,
  },
  largeTitle: {
    alignSelf: 'flex-start',
  },
});
