export type RouteTrackingSessionBridgeState = {
  uid: string | null;
  sessionVersion: number;
};

type SessionListener = (state: RouteTrackingSessionBridgeState) => void;

let state: RouteTrackingSessionBridgeState = { sessionVersion: 0, uid: null };
const listeners = new Set<SessionListener>();

export function setRouteTrackingSession(
  uid: string | null | undefined,
  sessionVersion: number,
): void {
  const nextState = { sessionVersion, uid: uid?.trim() || null };
  if (state.uid === nextState.uid && state.sessionVersion === nextState.sessionVersion) return;

  state = nextState;
  listeners.forEach((listener) => listener(state));
}

export function subscribeToRouteTrackingSession(listener: SessionListener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}
