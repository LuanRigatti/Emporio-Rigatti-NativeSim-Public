import type { NativeDropdownItem } from '../NativeDropdown';

export type NativePeriodActionGroupProps = {
  color?: string;
  monthItems: readonly NativeDropdownItem<number>[];
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  selectedMonth: number;
  selectedYear: number;
  yearItems: readonly NativeDropdownItem<number>[];
};
