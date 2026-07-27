import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, GlassSurface } from '@/components/premium';
import { useAppTheme } from '@/theme';

import type { HistoryCalendarDay } from '../data/historyMocks';

const CALENDAR_DAY_WIDTH = 44;
const CALENDAR_DAY_HEIGHT = 62;

export type HorizontalCalendarProps = {
  days: readonly HistoryCalendarDay[];
  datesWithDeliveries: ReadonlySet<string>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

type CalendarDayProps = {
  day: HistoryCalendarDay;
  hasDeliveries: boolean;
  selected: boolean;
  onSelectDate: (date: string) => void;
};

function CalendarDay({ day, hasDeliveries, onSelectDate, selected }: CalendarDayProps) {
  const { resolvedMode, theme } = useAppTheme();
  const selectedTextColor =
    resolvedMode === 'dark' ? theme.colors.textPrimary : theme.colors.textInverse;
  const selectedDayBackground =
    resolvedMode === 'dark' ? theme.colors.background : theme.colors.contrastSurface;

  return (
    <GlassSurface
      style={[
        styles.daySurface,
        {
          backgroundColor: selected ? selectedDayBackground : theme.colors.glassSurface,
          borderColor: selected
            ? resolvedMode === 'dark'
              ? theme.colors.contrastSurface
              : selectedDayBackground
            : theme.colors.glassBorder,
          borderRadius: theme.radius.card,
          height: CALENDAR_DAY_HEIGHT,
          width: CALENDAR_DAY_WIDTH,
        },
      ]}
    >
      <AnimatedPressable
        accessibilityLabel={`${day.weekday}, dia ${day.dayNumber}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => onSelectDate(day.date)}
        style={styles.dayButton}
      >
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[
            theme.typography.caption,
            styles.weekday,
            { color: selected ? selectedTextColor : theme.colors.textSecondary },
          ]}
        >
          {day.weekday}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            theme.typography.title3,
            styles.dayNumber,
            { color: selected ? selectedTextColor : theme.colors.textPrimary },
          ]}
        >
          {day.dayNumber}
        </Text>
        {hasDeliveries ? (
          <View style={[styles.deliveryDot, { backgroundColor: theme.colors.success }]} />
        ) : null}
      </AnimatedPressable>
    </GlassSurface>
  );
}

export function HorizontalCalendar({
  days,
  datesWithDeliveries,
  onSelectDate,
  selectedDate,
}: HorizontalCalendarProps) {
  const { theme } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndex = Math.max(
    0,
    days.findIndex((day) => day.date === selectedDate),
  );
  const scrollToSelectedDay = useCallback(() => {
    scrollRef.current?.scrollTo({
      animated: false,
      x: Math.max(0, (selectedIndex - 1) * (CALENDAR_DAY_WIDTH + theme.spacing.md)),
      y: 0,
    });
  }, [selectedIndex, theme.spacing.md]);

  useEffect(() => {
    const frame = requestAnimationFrame(scrollToSelectedDay);
    return () => cancelAnimationFrame(frame);
  }, [scrollToSelectedDay]);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { gap: theme.spacing.md }]}
      horizontal
      onContentSizeChange={scrollToSelectedDay}
      ref={scrollRef}
      showsHorizontalScrollIndicator={false}
    >
      {days.map((day) => {
        const selected = day.date === selectedDate;
        return (
          <CalendarDay
            day={day}
            hasDeliveries={datesWithDeliveries.has(day.date)}
            key={day.date}
            onSelectDate={onSelectDate}
            selected={selected}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'flex-start', paddingVertical: 2 },
  daySurface: { alignSelf: 'flex-start', overflow: 'hidden' },
  dayButton: {
    alignItems: 'center',
    height: CALENDAR_DAY_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 8,
    position: 'relative',
    width: CALENDAR_DAY_WIDTH,
  },
  deliveryDot: { borderRadius: 3, bottom: 6, height: 5, position: 'absolute', width: 5 },
  weekday: { fontSize: 11, lineHeight: 14, textAlign: 'center' },
  dayNumber: { fontSize: 16, lineHeight: 20 },
});
