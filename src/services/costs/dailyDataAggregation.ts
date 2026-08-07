import { normalizeMoney } from '@/utils/data';

export function addDailyValue(currentValue: string, addedValue: string): string {
  const current = normalizeMoney(currentValue) ?? 0;
  const addition = normalizeMoney(addedValue);
  if (addition === undefined || addition === 0) return currentValue;

  return String(current + addition);
}
