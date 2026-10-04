import { useCallback, useLayoutEffect, useRef } from 'react';

import { useAppMode } from '@/providers';

import {
  clearHomeModeTransition,
  getHomeModeTransition,
  markHomeModeTransitionCovered,
  markHomeModeTransitionRevealing,
  useHomeModeTransition,
} from '../hooks/useHomeModeTransition';
import { HomeModeTransitionOverlay } from './HomeModeTransitionOverlay';

export function HomeModeTransitionHost() {
  const appMode = useAppMode();
  const { transition } = useHomeModeTransition();
  const appModeRef = useRef(appMode);

  useLayoutEffect(() => {
    appModeRef.current = appMode;
  }, [appMode]);

  const onCovered = useCallback((id: number) => {
    const pending = getHomeModeTransition();
    const current = appModeRef.current;
    if (!pending || pending.id !== id || pending.phase !== 'covering') return;

    if (
      !current.isReady ||
      current.setMode !== pending.applyMode ||
      current.mode !== pending.sourceMode
    ) {
      clearHomeModeTransition(id);
      return;
    }

    const covered = markHomeModeTransitionCovered(id);
    covered?.applyMode(covered.targetMode);
  }, []);

  const onCancel = useCallback((id: number) => clearHomeModeTransition(id), []);
  const onRevealed = useCallback((id: number) => clearHomeModeTransition(id), []);

  useLayoutEffect(() => {
    if (!transition || transition.phase !== 'covered') return;

    if (!appMode.isReady || appMode.setMode !== transition.applyMode) {
      clearHomeModeTransition(transition.id);
    } else if (appMode.mode === transition.targetMode) {
      markHomeModeTransitionRevealing(transition.id);
    } else if (appMode.mode !== transition.sourceMode) {
      clearHomeModeTransition(transition.id);
    }
  }, [appMode, transition]);

  if (!transition) return null;

  return (
    <HomeModeTransitionOverlay
      key={transition.id}
      onCancel={onCancel}
      onCovered={onCovered}
      onRevealed={onRevealed}
      transition={transition}
    />
  );
}
