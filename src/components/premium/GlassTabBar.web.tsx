import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { useAppTheme } from '@/theme';
import { useVisualCapabilities } from '@/theme/visualCapabilities';
import { triggerSelectionHaptic } from '@/utils/haptics';

import { GlassSurface } from './GlassSurface';
import type { GlassTabBarItem, GlassTabBarProps } from './GlassTabBar.types';

type TabLayout = { x: number; width: number };

const spring = {
  damping: 21,
  mass: 0.85,
  stiffness: 220,
  useNativeDriver: false,
};

type WebTabItemProps = {
  item: GlassTabBarItem;
  barHeight: number;
  reduceMotionEnabled: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
};

function WebTabItem({ item, barHeight, reduceMotionEnabled, onLayout }: WebTabItemProps) {
  const { theme } = useAppTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const [iconOffset] = useState(() => new Animated.Value(0));

  const setPressed = (pressed: boolean) => {
    const targetScale = reduceMotionEnabled ? 1 : pressed ? 0.95 : 1;
    const targetOffset = reduceMotionEnabled ? 0 : pressed ? -1 : 0;

    if (reduceMotionEnabled) {
      scale.setValue(targetScale);
      iconOffset.setValue(targetOffset);
      return;
    }

    Animated.spring(scale, { ...spring, toValue: targetScale }).start();
    Animated.timing(iconOffset, {
      duration: theme.animations.duration.fast,
      toValue: targetOffset,
      useNativeDriver: false,
    }).start();
  };

  return (
    <Animated.View
      onLayout={onLayout}
      style={[styles.item, { minHeight: barHeight, transform: [{ scale }] }]}
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
        <Animated.View style={{ transform: [{ translateY: iconOffset }] }}>
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
  const { useBlur } = useVisualCapabilities();
  const reduceMotionEnabled = reduceMotionOverride ?? systemReduceMotion;
  const barHeight = theme.sizes.tabBarHeight + theme.spacing.sm;
  const activeKey = items.find((item) => item.selected)?.key ?? items[0]?.key;
  const [layouts, setLayouts] = useState<Record<string, TabLayout>>({});
  const [activeX] = useState(() => new Animated.Value(0));
  const [activeWidth] = useState(() => new Animated.Value(0));
  const [activePulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!activeKey || !layouts[activeKey]) return;

    const nextLayout = layouts[activeKey];
    if (reduceMotionEnabled) {
      activeX.setValue(nextLayout.x);
      activeWidth.setValue(nextLayout.width);
      activePulse.setValue(1);
      return;
    }

    activePulse.setValue(0);
    Animated.parallel([
      Animated.spring(activeX, { ...spring, toValue: nextLayout.x }),
      Animated.spring(activeWidth, { ...spring, toValue: nextLayout.width }),
      Animated.spring(activePulse, { ...spring, toValue: 1 }),
    ]).start();
  }, [activeKey, activePulse, activeWidth, activeX, layouts, reduceMotionEnabled]);

  const updateLayout = (key: string) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setLayouts((current) => {
      const previous = current[key];
      if (previous && previous.x === x && previous.width === width) return current;
      return { ...current, [key]: { x, width } };
    });
  };

  return (
    <GlassSurface
      accessibilityLabel={accessibilityLabel}
      blurIntensity={72}
      style={[
        styles.barFrame,
        {
          borderRadius: theme.radius.pill,
          minHeight: barHeight,
          padding: theme.spacing.xxs,
          ...(useBlur ? theme.shadows.elevated : theme.shadows.none),
        },
      ]}
    >
      <View style={[styles.container, { minHeight: barHeight }]}>
        <Animated.View
          style={[
            styles.activeCapsule,
            {
              pointerEvents: 'none',
              transform: [
                { translateX: activeX },
                {
                  scaleX: activePulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.98, 1],
                  }),
                },
              ],
              width: activeWidth,
            },
          ]}
        >
          <GlassSurface
            blurIntensity={84}
            glassEffectStyle="regular"
            interactive
            style={[styles.capsuleMaterial, { borderRadius: theme.radius.pill }]}
          />
        </Animated.View>
        <View accessibilityRole="tablist" style={[styles.row, { minHeight: barHeight }]}>
          {items.map((item) => (
            <WebTabItem
              barHeight={barHeight}
              item={item}
              key={item.key}
              onLayout={updateLayout(item.key)}
              reduceMotionEnabled={reduceMotionEnabled}
            />
          ))}
        </View>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  activeCapsule: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  barFrame: {
    alignSelf: 'stretch',
  },
  capsuleMaterial: {
    borderWidth: 0,
    flex: 1,
    overflow: 'hidden',
  },
  container: {
    alignSelf: 'stretch',
    position: 'relative',
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
  row: {
    alignItems: 'stretch',
    flexDirection: 'row',
    position: 'relative',
    zIndex: 1,
  },
});
