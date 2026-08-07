import type { RouteTrackingSession } from '@/types/routeTracking';

export type RouteDistanceSummary = {
  routeCount: number;
  totalKilometers: number;
};

export function summarizeRouteDistance(
  sessions: readonly RouteTrackingSession[],
): RouteDistanceSummary {
  return {
    routeCount: sessions.length,
    totalKilometers: sessions.reduce((total, session) => total + session.distanceMeters / 1000, 0),
  };
}
