import { useEffect, useRef } from 'react';
import type { LayoutChangeEvent } from 'react-native';

const STARTUP_DIAGNOSTICS_WINDOW_MS = 1000;
const startupStartedAt = Date.now();
const startupRunId = `${startupStartedAt}-${Math.random().toString(36).slice(2, 10)}`;

type StartupDiagnosticDetails = Record<string, unknown>;

function isStartupDiagnosticsActive() {
  return __DEV__ && Date.now() - startupStartedAt <= STARTUP_DIAGNOSTICS_WINDOW_MS;
}

export function logStartupDiagnostics(
  component: string,
  event: string,
  details: StartupDiagnosticDetails = {},
) {
  if (!isStartupDiagnosticsActive()) return;

  const timestamp = Date.now();
  console.log(
    '[startup-layout]',
    JSON.stringify({
      component,
      elapsedMs: timestamp - startupStartedAt,
      event,
      startupRunId,
      timestamp,
      ...details,
    }),
  );
}

export function startupLayoutHandler(component: string, details: StartupDiagnosticDetails = {}) {
  return (event: LayoutChangeEvent) => {
    logStartupDiagnostics(component, 'layout', {
      ...details,
      frame: event.nativeEvent.layout,
    });
  };
}

export function useStartupDiagnostics(component: string, details: StartupDiagnosticDetails = {}) {
  const latestDetails = useRef(details);

  useEffect(() => {
    latestDetails.current = details;
  }, [details]);

  useEffect(() => {
    logStartupDiagnostics(component, 'mount', latestDetails.current);
    return () => logStartupDiagnostics(component, 'unmount', latestDetails.current);
  }, [component]);

  useEffect(() => {
    logStartupDiagnostics(component, 'state', details);
  }, [component, details]);
}
