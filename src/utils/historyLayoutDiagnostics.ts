import type { LayoutRectangle } from 'react-native';

const HISTORY_DIAGNOSTICS_WINDOW_MS = 1500;
const HISTORY_DIAGNOSTICS_BUFFER_LIMIT = 500;

type HistoryDiagnosticEvent = {
  component: string;
  deliveryId: string | null;
  event: string;
  details: Record<string, unknown>;
  timestamp: number;
};

let historyRunStarted = false;
let historyDiagnosticsClosed = false;
let activeHistoryRun: {
  startedAt: number;
  historyRunId: string;
} | null = null;
const bufferedEvents: HistoryDiagnosticEvent[] = [];
const lastKnownSizes = new Map<string, LayoutRectangle>();

function emitHistoryDiagnostic(event: HistoryDiagnosticEvent, historyRunId: string, startedAt: number, bufferedBeforeFocus = false): void {
  console.log(
    '[history-layout]',
    JSON.stringify({
      component: event.component,
      deliveryId: event.deliveryId,
      elapsedMs: event.timestamp - startedAt,
      event: event.event,
      historyRunId,
      timestamp: event.timestamp,
      ...(bufferedBeforeFocus ? { bufferedBeforeFocus: true } : {}),
      ...event.details,
    }),
  );
}

function captureHistoryDiagnostic(event: HistoryDiagnosticEvent): void {
  if (!__DEV__ || historyDiagnosticsClosed) return;

  if (activeHistoryRun && Date.now() - activeHistoryRun.startedAt <= HISTORY_DIAGNOSTICS_WINDOW_MS) {
    emitHistoryDiagnostic(event, activeHistoryRun.historyRunId, activeHistoryRun.startedAt);
    return;
  }

  if (!historyRunStarted) {
    if (bufferedEvents.length >= HISTORY_DIAGNOSTICS_BUFFER_LIMIT) bufferedEvents.shift();
    bufferedEvents.push(event);
  }
}

export function startHistoryLayoutDiagnostics(): string | null {
  if (!__DEV__ || historyRunStarted) return activeHistoryRun?.historyRunId ?? null;

  historyRunStarted = true;
  const timestamp = Date.now();
  activeHistoryRun = {
    historyRunId: `${timestamp}-${Math.random().toString(36).slice(2, 10)}`,
    startedAt: timestamp,
  };

  const bufferedBeforeFocus = bufferedEvents.splice(0, bufferedEvents.length);
  bufferedBeforeFocus.forEach((event) => {
    emitHistoryDiagnostic(
      event,
      activeHistoryRun!.historyRunId,
      activeHistoryRun!.startedAt,
      true,
    );
  });
  logHistoryLayoutDiagnostics(null, 'HistoryScreen', 'focus-run-started');

  setTimeout(() => {
    activeHistoryRun = null;
    historyDiagnosticsClosed = true;
    bufferedEvents.splice(0, bufferedEvents.length);
    lastKnownSizes.clear();
  }, HISTORY_DIAGNOSTICS_WINDOW_MS);

  return activeHistoryRun.historyRunId;
}

export function logHistoryLayoutDiagnostics(
  deliveryId: string | null,
  component: string,
  event: string,
  details: Record<string, unknown> = {},
): void {
  captureHistoryDiagnostic({
    component,
    deliveryId,
    event,
    details,
    timestamp: Date.now(),
  });
}

export function logHistoryLayoutFrame(
  deliveryId: string,
  component: string,
  frame: LayoutRectangle,
): void {
  if (!__DEV__ || historyDiagnosticsClosed) return;

  const key = `${deliveryId}:${component}`;
  const previous = lastKnownSizes.get(key);
  const changed =
    !previous ||
    previous.width !== frame.width ||
    previous.height !== frame.height ||
    previous.x !== frame.x ||
    previous.y !== frame.y;

  if (changed) {
    logHistoryLayoutDiagnostics(
      deliveryId,
      component,
      previous ? 'layout-change' : 'first-layout',
      { frame },
    );
  }

  lastKnownSizes.set(key, frame);
}

export function logHistoryLayoutSize(
  deliveryId: string,
  component: string,
  size: { height: number; width: number },
): void {
  if (!__DEV__ || historyDiagnosticsClosed) return;

  const key = `${deliveryId}:${component}`;
  const previous = lastKnownSizes.get(key);
  const changed = !previous || previous.width !== size.width || previous.height !== size.height;

  if (changed) {
    logHistoryLayoutDiagnostics(
      deliveryId,
      component,
      previous ? 'content-size-change' : 'content-ready',
      { height: size.height, width: size.width },
    );
  }

  lastKnownSizes.set(key, {
    height: size.height,
    width: size.width,
    x: previous?.x ?? 0,
    y: previous?.y ?? 0,
  });
}
