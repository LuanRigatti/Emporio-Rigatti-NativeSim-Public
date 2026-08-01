import { useEffect } from 'react';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme';
import { triggerSelectionHaptic } from '@/utils/haptics';

import { NativeDateSelectorScroll } from './NativeDateSelectorScroll';
import type { NativeDateSelectorDay, NativeDateSelectorProps } from './NativeDateSelector.types';

const DAY_WIDTH = 42;
const DAY_HEIGHT = 56;

function DateCell({
  day,
  onSelectDate,
  selected,
}: {
  day: NativeDateSelectorDay;
  onSelectDate: (date: string) => void;
  selected: boolean;
}) {
  const { reduceMotionEnabled, theme } = useAppTheme();
  const selectionProgress = useSharedValue(selected ? 1 : 0);
  const selectedTextColor = theme.colors.textInverse;
  const selectedDayBackground = theme.colors.contrastSurface;

  useEffect(() => {
    selectionProgress.value = reduceMotionEnabled
      ? selected
        ? 1
        : 0
      : withSpring(selected ? 1 : 0, theme.animations.spring.responsive);
  }, [reduceMotionEnabled, selected, selectionProgress, theme.animations.spring.responsive]);

  const selectionBackgroundStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      selectionProgress.value,
      [0, 1],
      ['rgba(0, 0, 0, 0)', selectedDayBackground],
    ),
  }));
  const weekdayStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      selectionProgress.value,
      [0, 1],
      [theme.colors.textSecondary, selectedTextColor],
    ),
  }));
  const dayNumberStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      selectionProgress.value,
      [0, 1],
      [theme.colors.textPrimary, selectedTextColor],
    ),
  }));
  const deliveryDotStyle = useAnimatedStyle(() => ({
    opacity: 0.75 + selectionProgress.value * 0.25,
    transform: [{ scale: 0.9 + selectionProgress.value * 0.1 }],
  }));

  return (
    <View
      key={day.date}
      style={[
        styles.surface,
        {
          backgroundColor: theme.colors.glassSurface,
          borderRadius: theme.radius.xl,
        },
      ]}
    >
      <Pressable
        accessibilityLabel={`${day.weekday}, dia ${day.dayNumber}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => {
          if (!selected) {
            triggerSelectionHaptic();
          }
          onSelectDate(day.date);
        }}
        style={styles.button}
      >
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, selectionBackgroundStyle]}
        />
        <Animated.Text style={[styles.weekday, weekdayStyle]}>{day.weekday}</Animated.Text>
        <Animated.Text style={[styles.dayNumber, dayNumberStyle]}>{day.dayNumber}</Animated.Text>
        {day.hasDeliveries ? (
          <Animated.View
            style={[styles.dot, { backgroundColor: theme.colors.success }, deliveryDotStyle]}
          />
        ) : null}
      </Pressable>
    </View>
  );
}

export default function NativeDateSelectorFallback(props: NativeDateSelectorProps) {
  return (
    <NativeDateSelectorScroll
      {...props}
      renderDay={(day, selected, onSelectDate) => (
        <DateCell day={day} key={day.date} onSelectDate={onSelectDate} selected={selected} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  surface: { alignSelf: 'flex-start', height: DAY_HEIGHT, overflow: 'hidden', width: DAY_WIDTH },
  button: {
    alignItems: 'center',
    height: DAY_HEIGHT,
    justifyContent: 'center',
    position: 'relative',
    width: DAY_WIDTH,
  },
  weekday: { fontSize: 11, lineHeight: 14, textAlign: 'center' },
  dayNumber: { fontSize: 16, fontWeight: '600', lineHeight: 20 },
  dot: { borderRadius: 3, bottom: 6, height: 5, position: 'absolute', width: 5 },
});
