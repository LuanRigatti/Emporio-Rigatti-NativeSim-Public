import Ionicons from '@expo/vector-icons/Ionicons';
import { GlassContainer, GlassView } from 'expo-glass-effect';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/theme';
import { useVisualCapabilities } from '@/theme/visualCapabilities';
import { triggerSelectionHaptic } from '@/utils/haptics';

import { GlassSurface } from './GlassSurface';
import type { GlassTabBarItem, GlassTabBarProps } from './GlassTabBar.types';

type TabLayout = { x: number; width: number };
export type { GlassTabBarItem, GlassTabBarProps } from './GlassTabBar.types';

const capsuleSpring = {
  damping: 21,
  stiffness: 220,
  mass: 0.85,
  overshootClamping: false,
};

const pressSpring = {
  damping: 20,
  stiffness: 260,
  mass: 0.8,
  overshootClamping: false,
};

type GlassTabItemButtonProps = {
  item: GlassTabBarItem;
  reduceMotionEnabled: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
};

function GlassTabItemButton({ item, reduceMotionEnabled, onLayout }: GlassTabItemButtonProps) {
  const { theme } = useAppTheme();
  const barHeight = theme.sizes.tabBarHeight + theme.spacing.sm;
  const scale = useSharedValue(1);
  const iconOffset = useSharedValue(0);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: iconOffset.value }],
  }));

  const setPressed = (pressed: boolean) => {
    const targetScale = reduceMotionEnabled ? 1 : pressed ? 0.95 : 1;
    const targetOffset = reduceMotionEnabled ? 0 : pressed ? -1 : 0;

    scale.set(withSpring(targetScale, pressSpring));
    iconOffset.set(
      withTiming(targetOffset, {
        duration: reduceMotionEnabled
          ? theme.animations.duration.instant
          : theme.animations.duration.fast,
      }),
    );
  };

  return (
    <Animated.View
      onLayout={onLayout}
      style={[styles.item, { minHeight: barHeight }, contentStyle]}
    >
      <Pressable
        accessibilityLabel={item.label}
        accessibilityRole="tab"
        accessibilityState={{ selected: item.selected }}
        onPress={item.onPress}
        onPressIn={() => {
          triggerSelectionHaptic();
          setPressed(true);
        }}
        onPressOut={() => setPressed(false)}
        style={[
          styles.itemPressable,
          {
            minHeight: barHeight,
            paddingHorizontal: theme.spacing.xs,
            rowGap: theme.spacing.xxs,
          },
        ]}
      >
        <Animated.View style={iconStyle}>
          <Ionicons
            color={item.selected ? theme.colors.textPrimary : theme.colors.textSecondary}
            name={item.icon}
            size={theme.sizes.iconSmall}
          />
        </Animated.View>
        <Text
          numberOfLines={1}
          style={[
            theme.typography.caption,
            styles.label,
            {
              color: item.selected ? theme.colors.textPrimary : theme.colors.textSecondary,
              fontWeight: item.selected ? '700' : '500',
            },
          ]}
        >
          {item.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function GlassTabBar({ items, accessibilityLabel, reduceMotionOverride }: GlassTabBarProps) {
  const { theme, reduceMotionEnabled: systemReduceMotion } = useAppTheme();
  const { useGlass } = useVisualCapabilities();
  const reduceMotionEnabled = reduceMotionOverride ?? systemReduceMotion;
  const barHeight = theme.sizes.tabBarHeight + theme.spacing.sm;
  const activeKey = items.find((item) => item.selected)?.key ?? items[0]?.key;
  const [layouts, setLayouts] = useState<Record<string, TabLayout>>({});
  const activeX = useSharedValue(0);
  const activeWidth = useSharedValue(0);
  const activePulse = useSharedValue(1);

  useEffect(() => {
    if (!activeKey || !layouts[activeKey]) return;

    const nextLayout = layouts[activeKey];
    if (reduceMotionEnabled) {
      activeX.set(nextLayout.x);
      activeWidth.set(nextLayout.width);
      activePulse.set(1);
      return;
    }

    activePulse.set(0);
    activeX.set(withSpring(nextLayout.x, capsuleSpring));
    activeWidth.set(withSpring(nextLayout.width, capsuleSpring));
    activePulse.set(withSpring(1, capsuleSpring));
  }, [activeKey, activePulse, activeWidth, activeX, layouts, reduceMotionEnabled]);

  const activeCapsuleStyle = useAnimatedStyle(() => ({
    width: activeWidth.value,
    transform: [
      { translateX: activeX.value },
      { scaleX: interpolate(activePulse.value, [0, 1], [0.98, 1]) },
    ],
  }));

  const updateLayout = (key: string) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setLayouts((current) => {
      const previous = current[key];
      if (previous && previous.x === x && previous.width === width) return current;
      return { ...current, [key]: { x, width } };
    });
  };

  const tabContent = (
    <View style={[styles.container, { minHeight: barHeight }]}>
      <Animated.View pointerEvents="none" style={[styles.activeCapsule, activeCapsuleStyle]}>
        {useGlass ? (
          <GlassView
            glassEffectStyle="regular"
            isInteractive
            style={[
              StyleSheet.absoluteFill,
              styles.capsuleMaterial,
              { borderRadius: theme.radius.pill },
            ]}
          />
        ) : (
          <GlassSurface
            bordered
            blurIntensity={84}
            glassEffectStyle="regular"
            interactive
            style={[styles.capsuleMaterial, { borderRadius: theme.radius.pill }]}
          />
        )}
      </Animated.View>
      <View accessibilityRole="tablist" style={[styles.row, { minHeight: barHeight }]}>
        {items.map((item) => (
          <GlassTabItemButton
            item={item}
            key={item.key}
            onLayout={updateLayout(item.key)}
            reduceMotionEnabled={reduceMotionEnabled}
          />
        ))}
      </View>
    </View>
  );

  if (useGlass) {
    return (
      <View accessibilityLabel={accessibilityLabel} style={styles.barFrame}>
        <GlassContainer
          spacing={theme.spacing.xxs}
          style={[styles.container, { minHeight: barHeight }]}
        >
          <GlassView
            glassEffectStyle="regular"
            isInteractive
            style={[
              StyleSheet.absoluteFill,
              styles.barMaterial,
              { borderRadius: theme.radius.pill },
            ]}
          />
          {tabContent}
        </GlassContainer>
      </View>
    );
  }

  return (
    <GlassSurface
      accessibilityLabel={accessibilityLabel}
      bordered
      blurIntensity={72}
      style={[
        styles.barFrame,
        {
          borderRadius: theme.radius.pill,
          padding: theme.spacing.xxs,
          shadowColor: theme.colors.textPrimary,
          minHeight: barHeight,
          ...theme.shadows.elevated,
        },
      ]}
    >
      {tabContent}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  barFrame: {
    alignSelf: 'stretch',
  },
  barMaterial: {
    borderWidth: 0,
    overflow: 'hidden',
  },
  capsuleMaterial: {
    borderWidth: 0,
    overflow: 'hidden',
  },
  container: {
    alignSelf: 'stretch',
    position: 'relative',
  },
  activeCapsule: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  row: {
    alignItems: 'stretch',
    flexDirection: 'row',
    position: 'relative',
    zIndex: 1,
  },
  item: {
    flex: 1,
  },
  itemPressable: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
  },
});
