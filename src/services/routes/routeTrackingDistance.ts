import type { DailyExpenses } from '@/types/data';
import type { RouteFinancialSummary, RouteTrackingSession } from '@/types/routeTracking';
import { normalizeLegacyDate, normalizeMoney } from '@/utils/data';

export type RouteDistanceSummary = {
  routeCount: number;
  totalKilometers: number;
};

export type RouteKilometersByDate = Readonly<Record<string, number>>;

export type ConsolidatedDistanceSummary = {
  gpsKilometers: number;
  manualKilometers: number;
  totalKilometers: number;
  routeCount: number;
};

export function deduplicateRouteFinancialSummaries(
  summaries: readonly RouteFinancialSummary[],
): RouteFinancialSummary[] {
  const byRouteId = new Map<string, RouteFinancialSummary>();
  summaries.forEach((summary) => {
    if (!byRouteId.has(summary.id)) byRouteId.set(summary.id, summary);
  });
  return [...byRouteId.values()];
}

export function summarizeRouteDistance(
  sessions: readonly RouteTrackingSession[],
): RouteDistanceSummary {
  const uniqueSessions = deduplicateRouteFinancialSummaries(sessions);
  return {
    routeCount: uniqueSessions.length,
    totalKilometers: uniqueSessions.reduce(
      (total, session) => total + session.distanceMeters / 1000,
      0,
    ),
  };
}

export function summarizeRouteKilometersByDate(
  sessions: readonly RouteFinancialSummary[],
): RouteKilometersByDate {
  return deduplicateRouteFinancialSummaries(sessions).reduce<Record<string, number>>(
    (byDate, session) => {
      const date = normalizeLegacyDate(session.date) ?? session.date.trim();
      if (!date) return byDate;
      byDate[date] = (byDate[date] ?? 0) + session.distanceMeters / 1000;
      return byDate;
    },
    {},
  );
}

export function summarizeConsolidatedKilometers(
  sessions: readonly RouteTrackingSession[],
  dailyExpenses: DailyExpenses = {},
  isDateInPeriod: (date: string) => boolean = () => true,
): ConsolidatedDistanceSummary {
  const matchingSessions = deduplicateRouteFinancialSummaries(sessions).filter((session) =>
    isDateInPeriod(session.date),
  );
  const gpsKilometers = matchingSessions.reduce(
    (total, session) => total + session.distanceMeters / 1000,
    0,
  );
  const manualKilometers = Object.entries(dailyExpenses)
    .filter(([date]) => isDateInPeriod(date))
    .reduce((total, [, expense]) => total + (normalizeMoney(expense?.km) ?? 0), 0);

  return {
    gpsKilometers,
    manualKilometers,
    totalKilometers: gpsKilometers + manualKilometers,
    routeCount: matchingSessions.length,
  };
}
