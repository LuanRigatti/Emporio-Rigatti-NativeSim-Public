import type { NativeDropdownItem } from '../NativeDropdown';

export type NativePeriodActionGroupProps = {
  color?: string;
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
