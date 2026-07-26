import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useAppTheme } from '@/theme';
import { triggerSelectionHaptic } from '@/utils/haptics';

import { AnimatedPressable } from './AnimatedPressable';
import { GlassSurface } from './GlassSurface';

export type SegmentControlItem = { key: string; label: string };

export type SegmentControlProps = {
  items: readonly SegmentControlItem[];
  selectedKey: string;
  onChange: (key: string) => void;
  accessibilityLabel?: string;
};

export function SegmentControl({
  accessibilityLabel,
  items,
  onChange,
  selectedKey,
}: SegmentControlProps) {
  const { theme, reduceMotionEnabled } = useAppTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.key === selectedKey),
  );
  const activeIndex = useSharedValue(selectedIndex);
  const itemWidth = items.length ? containerWidth / items.length : 0;
  const spring = useMemo(
    () =>
      reduceMotionEnabled
        ? { damping: 100, stiffness: 1000, mass: 1 }
        : theme.animations.spring.gentle,
    [reduceMotionEnabled, theme.animations.spring.gentle],
  );

  useEffect(() => {
    activeIndex.value = withSpring(selectedIndex, spring);
  }, [activeIndex, selectedIndex, spring]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: activeIndex.value * itemWidth }],
  }));

  const onLayout = (event: LayoutChangeEvent) => setContainerWidth(event.nativeEvent.layout.width);
  const indicatorWidth = useMemo(() => ({ width: itemWidth }), [itemWidth]);

  return (
    <GlassSurface accessibilityLabel={accessibilityLabel} accessibilityRole="tablist">
      <View
        onLayout={onLayout}
        style={[styles.row, { gap: theme.spacing.xxs, padding: theme.spacing.xxs }]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            indicatorWidth,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderRadius: theme.radius.pill,
            },
            indicatorStyle,
          ]}
        />
        {items.map((item) => {
          const selected = item.key === selectedKey;

          return (
            <AnimatedPressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={item.key}
              onPress={() => {
                triggerSelectionHaptic();
                onChange(item.key);
              }}
              style={[
                styles.item,
                { borderRadius: theme.radius.pill, minHeight: theme.sizes.touchTargetMinimum },
              ]}
            >
              <Text
                style={[
                  theme.typography.subheadline,
                  { color: selected ? theme.colors.textPrimary : theme.colors.textSecondary },
                ]}
              >
                {item.label}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', position: 'relative' },
  indicator: { bottom: 0, left: 0, position: 'absolute', top: 0 },
  item: { alignItems: 'center', flex: 1, justifyContent: 'center', zIndex: 1 },
});
