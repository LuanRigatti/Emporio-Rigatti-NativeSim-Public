import type { NativeStackNavigationProp } from 'expo-router';

type RootNavigation = NativeStackNavigationProp<Record<string, object | undefined>>;

export type RootTabsTransitionPhase = 'idle' | 'entering' | 'settled' | 'leaving';

export type RootTabsTransitionSnapshot = {
  cycle: number;
  phase: RootTabsTransitionPhase;
};

const listeners = new Set<(snapshot: RootTabsTransitionSnapshot) => void>();
let snapshot: RootTabsTransitionSnapshot = { cycle: 0, phase: 'idle' };

function publish(next: RootTabsTransitionSnapshot): void {
  snapshot = next;
  for (const listener of [...listeners]) listener(snapshot);
}

export function getRootTabsTransitionSnapshot(): RootTabsTransitionSnapshot {
  return snapshot;
}

export function resetRootTabsTransitionAfterGestureCancel(): void {
  if (snapshot.phase !== 'idle') publish({ ...snapshot, phase: 'idle' });
}

export function subscribeToRootTabsTransitionChanges(
  listener: (snapshot: RootTabsTransitionSnapshot) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Called by the `(tabs)` root route. Native Stack transition events target the
 * route key, so a nested Home screen cannot observe this return transition from
 * its own tab navigator.
 */
export function observeRootTabsTransition(navigation: RootNavigation): () => void {
  let cycle = snapshot.cycle;
  const update = (phase: RootTabsTransitionPhase, incrementCycle = false) => {
    if (incrementCycle) cycle += 1;
    publish({ cycle, phase });
  };

  const removeStart = navigation.addListener('transitionStart', ({ data }) => {
    update(data.closing ? 'leaving' : 'entering', !data.closing);
  });
  const removeEnd = navigation.addListener('transitionEnd', ({ data }) => {
    update(data.closing ? 'idle' : 'settled');
  });

  return () => {
    removeStart();
    removeEnd();
    if (snapshot.cycle === cycle) {
      publish({ cycle, phase: 'idle' });
    }
  };
}
