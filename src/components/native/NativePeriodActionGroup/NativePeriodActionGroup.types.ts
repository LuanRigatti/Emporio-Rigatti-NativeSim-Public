import type { NativeDropdownItem } from '../NativeDropdown';

export type NativePeriodActionGroupProps = {
  color?: string;
  glassTint?: string;
  dayItems?: readonly NativeDropdownItem<string>[];
  dayPicker?: boolean;
  valueFontSize?: number;
  monthItems: readonly NativeDropdownItem<number>[];
  monthDisplayValue?: string;
  onDayChange?: (date: string) => void;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  selectedDay?: string;
  selectedMonth: number;
  selectedYear: number;
  showValues?: boolean;
  yearItems: readonly NativeDropdownItem<number>[];
};

export function getNativePeriodActionGroupWidth({
  dayItems,
  onDayChange,
  selectedDay,
  showValues,
}: Pick<NativePeriodActionGroupProps, 'dayItems' | 'onDayChange' | 'selectedDay' | 'showValues'>):
  104 | 112 | 152 {
  const includesDay = Boolean(dayItems?.length && onDayChange && selectedDay);
  return showValues ? 112 : includesDay ? 152 : 104;
}
