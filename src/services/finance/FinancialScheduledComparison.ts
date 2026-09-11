import { normalizeLegacyDate } from '@/utils/data';

/**
 * Normal scheduled delivery route weekdays:
 * Monday (1), Wednesday (3), Friday (5).
 */
export const SCHEDULED_ROUTE_WEEKDAYS = [1, 3, 5] as const;

export interface ScheduledMonthComparisonCutoffs {
  /** Total scheduled days completed in the analyzed month */
  n: number;
  /** Maximum comparable scheduled days present in both months */
  comparableN: number;
  /** Cutoff ISO date string for analyzed month, or null if comparableN === 0 */
  currentCutoff: string | null;
  /** Cutoff ISO date string for previous month, or null if comparableN === 0 */
  previousCutoff: string | null;
  /** All scheduled dates in the analyzed month */
  currentScheduledDates: string[];
  /** All scheduled dates in the previous month */
  previousScheduledDates: string[];
}

/**
 * Returns all dates in 'YYYY-MM' matching scheduled route weekdays (Mon/Wed/Fri).
 */
export function getScheduledRouteDatesInMonth(monthKey: string): string[] {
  const normalized = normalizeLegacyDate(`${monthKey}-01`);
  if (!normalized) return [];
  const [year, month] = normalized.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates: string[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day, 12, 0, 0);
    const weekday = d.getDay();
    if (weekday === 1 || weekday === 3 || weekday === 5) {
      const dayStr = String(day).padStart(2, '0');
      const monthStr = String(month).padStart(2, '0');
      dates.push(`${year}-${monthStr}-${dayStr}`);
    }
  }

  return dates;
}

/**
 * Computes scheduled route comparison cutoffs with the comparableN constraint.
 */
export function calculateScheduledMonthComparisonCutoffs(
  selectedMonth: string,
  today: Date = new Date(),
): ScheduledMonthComparisonCutoffs {
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  const todayIso = `${todayYear}-${String(todayMonth).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;
  const currentMonthKey = todayIso.slice(0, 7);

  const [selYear, selMonth] = selectedMonth.split('-').map(Number);
  const prevDate = new Date(selYear, selMonth - 2, 1, 12, 0, 0);
  const previousMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const currentScheduledDates = getScheduledRouteDatesInMonth(selectedMonth);
  const previousScheduledDates = getScheduledRouteDatesInMonth(previousMonth);

  let n = 0;

  if (selectedMonth < currentMonthKey) {
    // Historical completed month
    n = currentScheduledDates.length;
  } else if (selectedMonth === currentMonthKey) {
    // Current active month: only scheduled days <= today
    const completed = currentScheduledDates.filter((d) => d <= todayIso);
    n = completed.length;
  } else {
    // Future month
    n = 0;
  }

  const comparableN = Math.min(n, previousScheduledDates.length);

  if (comparableN === 0) {
    return {
      n,
      comparableN: 0,
      currentCutoff: null,
      previousCutoff: null,
      currentScheduledDates,
      previousScheduledDates,
    };
  }

  const currentCutoff = currentScheduledDates[comparableN - 1];
  const previousCutoff = previousScheduledDates[comparableN - 1];

  return {
    n,
    comparableN,
    currentCutoff,
    previousCutoff,
    currentScheduledDates,
    previousScheduledDates,
  };
}
