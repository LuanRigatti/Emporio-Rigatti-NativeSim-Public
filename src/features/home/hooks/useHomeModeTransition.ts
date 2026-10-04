import { useCallback, useSyncExternalStore } from 'react';

import type { AppModeContextValue } from '@/providers/AppModeProvider';
import type { AppMode } from '@/types/appMode';

export type HomeModeTransition = {
  id: number;
  phase: 'covering' | 'covered' | 'revealing';
  sourceMode: AppMode;
  targetMode: AppMode;
  applyMode: AppModeContextValue['setMode'];
};

let activeTransition: HomeModeTransition | null = null;
let nextTransitionId = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(transition: HomeModeTransition | null) {
  activeTransition = transition;
  listeners.forEach((listener) => listener());
}

export function getHomeModeTransition() {
  return activeTransition;
}

export function requestHomeModeTransition(
  sourceMode: AppMode,
  targetMode: AppMode,
  applyMode: AppModeContextValue['setMode'],
) {
  if (activeTransition || sourceMode === targetMode) return;

  publish({
    id: ++nextTransitionId,
    phase: 'covering',
    sourceMode,
    targetMode,
    applyMode,
  });
}

export function markHomeModeTransitionCovered(id: number) {
  if (activeTransition?.id !== id || activeTransition.phase !== 'covering') return null;

  const covered = { ...activeTransition, phase: 'covered' as const };
  publish(covered);
  return covered;
}

export function markHomeModeTransitionRevealing(id: number) {
  if (activeTransition?.id !== id || activeTransition.phase !== 'covered') return;

  publish({ ...activeTransition, phase: 'revealing' });
}

export function clearHomeModeTransition(id: number) {
  if (activeTransition?.id !== id) return;
  publish(null);
}

export function useHomeModeTransition(appMode?: AppModeContextValue) {
  const transition = useSyncExternalStore(subscribe, getHomeModeTransition, getHomeModeTransition);
  const mode = appMode?.mode;
  const isReady = appMode?.isReady;
  const applyMode = appMode?.setMode;
  const request = useCallback(
    (targetMode: AppMode) => {
      if (!isReady || mode === undefined || !applyMode) return;
      requestHomeModeTransition(mode, targetMode, applyMode);
    },
    [applyMode, isReady, mode],
  );

  return {
    isTransitioning: transition !== null,
    requestModeTransition: request,
    transition,
  };
}
