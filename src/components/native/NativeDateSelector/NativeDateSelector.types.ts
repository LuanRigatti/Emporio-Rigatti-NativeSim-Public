import type { NativeButtonHaptic } from '@/types/native-ui';

export type NativeDateSelectorDay = {
  date: string;
  weekday: string;
  dayNumber: string | number;
  hasDeliveries?: boolean;
};

export type NativeDateSelectorProps = {
  days: readonly NativeDateSelectorDay[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  haptic?: NativeButtonHaptic;
};
