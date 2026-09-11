import type { NativeDropdownItem } from '@/components/native';

import { getAvailableHistoryYears, HISTORY_MONTH_NAMES } from '../utils/historyDateUtils';

export const HISTORY_MONTH_ITEMS: readonly NativeDropdownItem<number>[] = HISTORY_MONTH_NAMES.map(
  (label, index) => ({ label, value: index + 1 }),
);

export function getHistoryYearItems(): readonly NativeDropdownItem<number>[] {
  return getAvailableHistoryYears().map((value) => ({ label: String(value), value }));
}
