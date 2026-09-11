import { getCurrentHistoryPeriod } from '@/features/history/utils/historyDateUtils';

export interface MonthlyPeriod {
  month: number;
  year: number;
}

const PERIOD_REGEX = /^(\d{4})-(\d{2})$/;

export function parseMonthlyPeriodParam(
  param: string | string[] | undefined | null,
  fallback: MonthlyPeriod = getCurrentHistoryPeriod(),
): MonthlyPeriod {
  const value = Array.isArray(param) ? param[0] : param;
  if (!value || typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  const match = PERIOD_REGEX.exec(trimmed);
  if (!match) {
    return fallback;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12
  ) {
    return fallback;
  }

  return { month, year };
}

export function formatMonthlyPeriodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}
