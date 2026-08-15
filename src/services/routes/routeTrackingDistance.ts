import type { RouteTrackingSession } from '@/types/routeTracking';
import { normalizeLegacyDate } from '@/utils/data';

export type RouteDistanceSummary = {
  routeCount: number;
  totalKilometers: number;
};

export type RouteKilometersByDate = Readonly<Record<string, number>>;

export function summarizeRouteDistance(
  sessions: readonly RouteTrackingSession[],
): RouteDistanceSummary {
  return {
    routeCount: sessions.length,
    totalKilometers: sessions.reduce((total, session) => total + session.distanceMeters / 1000, 0),
  };
}

export function summarizeRouteKilometersByDate(
  sessions: readonly RouteTrackingSession[],
): RouteKilometersByDate {
  return sessions.reduce<Record<string, number>>((byDate, session) => {
    const date = normalizeLegacyDate(session.date) ?? session.date.trim();
    if (!date) return byDate;
    byDate[date] = (byDate[date] ?? 0) + session.distanceMeters / 1000;
    return byDate;
  }, {});
}
