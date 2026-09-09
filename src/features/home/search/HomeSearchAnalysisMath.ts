import type {
  HomeSearchAnalysisPoint,
  HomeSearchAnalysisTrendDirection,
  HomeSearchPeriod,
} from './HomeSearchTypes';

export function safeDivide(numerator: number, denominator: number): number {
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0
    ? numerator / denominator
    : 0;
}

export function percentageChange(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function sumValues(values: readonly number[]): number {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

export function averageValues(values: readonly number[]): number {
  return values.length > 0 ? sumValues(values) / values.length : 0;
}

export function classifyTrend(
  points: readonly HomeSearchAnalysisPoint[],
): HomeSearchAnalysisTrendDirection {
  if (points.length < 2) return 'stable';
  const deltas = points.slice(1).map((point, index) => point.value - points[index].value);
  const epsilon = 0.0001;
  if (deltas.every((delta) => Math.abs(delta) <= epsilon)) return 'stable';
  if (deltas.every((delta) => delta > epsilon)) return 'rising';
  if (deltas.every((delta) => delta < -epsilon)) return 'falling';
  return 'mixed';
}

function parseISODate(value: string): Date | undefined {
  const [year, month, day] = value.split('-').map(Number);
  if (![year, month, day].every(Number.isInteger)) return undefined;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : undefined;
}

function formatISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function previousComparablePeriod(period: HomeSearchPeriod): HomeSearchPeriod | undefined {
  if (period.kind === 'month') {
    const date = new Date(period.year ?? new Date().getFullYear(), period.month - 2, 1, 12);
    return { kind: 'month', month: date.getMonth() + 1, year: date.getFullYear() };
  }
  if (period.kind === 'year') return { kind: 'year', year: period.year - 1 };
  if (period.kind === 'date') {
    const date = parseISODate(period.date);
    if (!date) return undefined;
    date.setDate(date.getDate() - 1);
    return { kind: 'date', date: formatISODate(date) };
  }
  if (period.kind !== 'range') return undefined;
  const start = parseISODate(period.startDate);
  const end = parseISODate(period.endDate);
  if (!start || !end || start > end) return undefined;
  const durationDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - durationDays + 1);
  return {
    kind: 'range',
    startDate: formatISODate(previousStart),
    endDate: formatISODate(previousEnd),
  };
}

export function coveragePeriodForReport(period: HomeSearchPeriod): HomeSearchPeriod {
  const previous = previousComparablePeriod(period);
  if (!previous) return period;
  const bounds = (value: HomeSearchPeriod): [string, string] | undefined => {
    if (value.kind === 'date') return [value.date, value.date];
    if (value.kind === 'month') {
      const year = value.year ?? new Date().getFullYear();
      const start = `${year}-${String(value.month).padStart(2, '0')}-01`;
      const endDate = new Date(year, value.month, 0, 12);
      return [start, formatISODate(endDate)];
    }
    if (value.kind === 'year') return [`${value.year}-01-01`, `${value.year}-12-31`];
    if (value.kind === 'range') return [value.startDate, value.endDate];
    return undefined;
  };
  const currentBounds = bounds(period);
  const previousBounds = bounds(previous);
  if (!currentBounds || !previousBounds) return period;
  return {
    kind: 'range',
    startDate: currentBounds[0] < previousBounds[0] ? currentBounds[0] : previousBounds[0],
    endDate: currentBounds[1] > previousBounds[1] ? currentBounds[1] : previousBounds[1],
  };
}
