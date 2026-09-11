import type { RouteTrackingSession } from '@/types/routeTracking';

/** Selects local sessions in the exact order requested by Home Search. */
export function selectHomeSearchRouteSessions(
  history: readonly RouteTrackingSession[],
  sessionIds: readonly string[],
): RouteTrackingSession[] {
  const sessionsById = new Map(history.map((session) => [session.id, session]));
  return Array.from(new Set(sessionIds.filter((sessionId) => sessionId.length > 0))).flatMap(
    (sessionId) => {
      const session = sessionsById.get(sessionId);
      return session ? [session] : [];
    },
  );
}
