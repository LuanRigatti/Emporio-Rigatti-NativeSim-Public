import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import type { ReactElement } from 'react';

import { useAppTheme } from '@/theme';

import type { NativeDateSelectorDay, NativeDateSelectorProps } from './NativeDateSelector.types';

const DAY_WIDTH = 40;

type NativeDateSelectorScrollProps = NativeDateSelectorProps & {
  renderDay: (
    day: NativeDateSelectorDay,
    selected: boolean,
    onSelectDate: (date: string) => void,
  ) => ReactElement;
};

export function NativeDateSelectorScroll({
  days,
  onSelectDate,
  renderDay,
  selectedDate,
}: NativeDateSelectorScrollProps) {
  const { theme } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const initialPositionedRef = useRef(false);
  const scrollOffsetRef = useRef(0);
  const viewportWidthRef = useRef(0);
  const selectedIndex = Math.max(
    0,
    days.findIndex((day) => day.date === selectedDate),
  );
  const positionSelectedDay = useCallback(() => {
    const stride = DAY_WIDTH + theme.spacing.sm;
    const edgeInset = theme.spacing.xs;
    const selectedStart = edgeInset + selectedIndex * stride;
    const selectedEnd = selectedStart + DAY_WIDTH;
    const isInitialPosition = !initialPositionedRef.current;
    const viewportWidth = viewportWidthRef.current;
    const currentOffset = scrollOffsetRef.current;

    if (isInitialPosition && viewportWidth <= 0) return;

    let targetOffset = currentOffset;
    if (isInitialPosition) {
      targetOffset = Math.max(0, selectedStart - stride);
    } else if (selectedStart < currentOffset + edgeInset) {
      targetOffset = selectedStart - edgeInset;
    } else if (selectedEnd > currentOffset + viewportWidth - edgeInset) {
      targetOffset = selectedEnd - viewportWidth + edgeInset;
    }

    initialPositionedRef.current = true;
    if (Math.abs(targetOffset - currentOffset) < 1) return;

    scrollRef.current?.scrollTo({
      animated: !isInitialPosition,
      x: Math.max(0, targetOffset),
      y: 0,
    });
  }, [selectedIndex, theme.spacing.sm, theme.spacing.xs]);

  useEffect(() => {
    const frame = requestAnimationFrame(positionSelectedDay);
    return () => cancelAnimationFrame(frame);
  }, [positionSelectedDay]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          gap: theme.spacing.sm,
          paddingLeft: theme.spacing.xs,
          paddingRight: theme.spacing.xs,
        },
      ]}
      horizontal
      onContentSizeChange={positionSelectedDay}
      onLayout={(event) => {
        viewportWidthRef.current = event.nativeEvent.layout.width;
        requestAnimationFrame(positionSelectedDay);
      }}
      onScroll={(event) => {
        scrollOffsetRef.current = event.nativeEvent.contentOffset.x;
      }}
      ref={scrollRef}
      scrollEventThrottle={16}
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: 0 }}
    >
      {days.map((day) => renderDay(day, day.date === selectedDate, onSelectDate))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'flex-start', paddingVertical: 2 },
});
