import { NativeDateSelector } from '@/components/native';

import type { HistoryCalendarDay } from '../data/historyMocks';

export type HorizontalCalendarProps = {
  days: readonly HistoryCalendarDay[];
  datesWithDeliveries: ReadonlySet<string>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

export function HorizontalCalendar({
  days,
  datesWithDeliveries,
  onSelectDate,
  selectedDate,
}: HorizontalCalendarProps) {
  return (
    <NativeDateSelector
      days={days.map((day) => ({
        date: day.date,
        dayNumber: day.dayNumber,
        hasDeliveries: datesWithDeliveries.has(day.date),
        weekday: day.weekday,
      }))}
      onSelectDate={onSelectDate}
      selectedDate={selectedDate}
    />
  );
}
