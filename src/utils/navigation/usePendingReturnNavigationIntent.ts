import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useFocusEffect, type NativeStackNavigationProp } from 'expo-router';
import { Platform } from 'react-native';

import { getNavigationTopRoute } from '@/utils/navigation/navigationTopRoute';
import {
  getRootTabsTransitionSnapshot,
  resetRootTabsTransitionAfterGestureCancel,
  subscribeToRootTabsTransitionChanges,
  type RootTabsTransitionPhase,
} from '@/utils/navigation/rootTabsTransition';

type Navigation = NativeStackNavigationProp<Record<string, object | undefined>>;
type TransitionPhase = RootTabsTransitionPhase;

type PendingIntent = {
  key: string;
  cycle: number;
  execute: (deferred: boolean) => void;
};

const pendingIntentCancellersByRoute = new Map<string, Set<() => void>>();

function registerGestureCancellationForOutgoingRoutes(
  routeNames: readonly string[],
  cancel: () => void,
): () => void {
  const registrations = routeNames.map((routeName) => {
    const cancellers = pendingIntentCancellersByRoute.get(routeName) ?? new Set<() => void>();
    cancellers.add(cancel);
    pendingIntentCancellersByRoute.set(routeName, cancellers);
    return { routeName, cancellers };
  });

  return () => {
    for (const { routeName, cancellers } of registrations) {
      cancellers.delete(cancel);
      if (cancellers.size === 0) pendingIntentCancellersByRoute.delete(routeName);
    }
  };
}

export function cancelPendingReturnIntentsForGestureCancelledRoute(routeName: string): void {
  for (const cancel of [...(pendingIntentCancellersByRoute.get(routeName) ?? [])]) cancel();
  resetRootTabsTransitionAfterGestureCancel();
}

export function useCancelPendingReturnIntentsOnGestureCancel(
  navigation: Navigation,
  routeName: string,
): void {
  useEffect(
    () =>
      navigation.addListener('gestureCancel', () => {
        cancelPendingReturnIntentsForGestureCancelledRoute(routeName);
      }),
    [navigation, routeName],
  );
}

export function useReleaseNavigationGuardOnWebReturn(onReturn: () => void): void {
  const didBlurRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web') return;
      if (didBlurRef.current) onReturn();
      didBlurRef.current = false;
      return () => {
        didBlurRef.current = true;
      };
    }, [onReturn]),
  );
}

export type ReturnIntentDecision = 'executed' | 'pending' | 'consolidated' | 'blocked';

export type ReturnIntentRequest = {
  key: string;
  execute: (deferred: boolean) => void;
};

type Options = {
  enabled?: boolean;
  navigation: Navigation;
  sourceRouteName: string;
  expectedOutgoingRouteNames: readonly string[];
  isSourceActive?: () => boolean;
  getCurrentRouteName?: () => string | undefined;
  rootTabsTransition?: boolean;
};

export function usePendingReturnNavigationIntent({
  enabled = true,
  expectedOutgoingRouteNames,
  getCurrentRouteName,
  isSourceActive,
  navigation,
  rootTabsTransition = false,
  sourceRouteName,
}: Options): (request: ReturnIntentRequest) => ReturnIntentDecision {
  const pendingRef = useRef<PendingIntent | null>(null);
  const localTransitionRef = useRef<{ cycle: number; phase: TransitionPhase }>({
    cycle: 0,
    phase: 'idle',
  });
  const mountedRef = useRef(false);
  const optionsRef = useRef<Options | null>(null);
  const outgoingRouteRegistrationKey = expectedOutgoingRouteNames.join('\u0000');
  const currentOptions: Options = {
    enabled,
    expectedOutgoingRouteNames,
    getCurrentRouteName,
    isSourceActive,
    navigation,
    rootTabsTransition,
    sourceRouteName,
  };

  useLayoutEffect(() => {
    optionsRef.current = currentOptions;
  });

  const topRoute = useCallback(() => {
    const current = optionsRef.current;
    return current?.getCurrentRouteName?.() ?? getNavigationTopRoute(navigation);
  }, [navigation]);

  const transition = useCallback(() => {
    if (optionsRef.current?.rootTabsTransition) {
      const rootTransition = getRootTabsTransitionSnapshot();
      return { cycle: rootTransition.cycle, phase: rootTransition.phase };
    }
    return localTransitionRef.current;
  }, []);

  const isActive = useCallback(() => {
    const current = optionsRef.current;
    const routeName = topRoute();
    return Boolean(
      current?.isSourceActive?.() ??
      (current?.navigation.isFocused() && routeName === current?.sourceRouteName),
    );
  }, [topRoute]);

  const cancelPending = useCallback(() => {
    pendingRef.current = null;
  }, []);

  const tryFlushPending = useCallback(() => {
    const pending = pendingRef.current;
    const current = optionsRef.current;
    if (!pending || !current?.enabled || !mountedRef.current) return;

    const activeTransition = transition();
    if (activeTransition.cycle !== pending.cycle) {
      cancelPending();
      return;
    }
    if (activeTransition.phase === 'leaving' || activeTransition.phase === 'idle') {
      cancelPending();
      return;
    }

    const routeName = topRoute();
    if (
      !routeName ||
      (routeName !== current.sourceRouteName &&
        !current.expectedOutgoingRouteNames.includes(routeName))
    ) {
      cancelPending();
      return;
    }

    if (activeTransition.phase !== 'settled' || !isActive()) return;

    pendingRef.current = null;
    if (!current.rootTabsTransition)
      localTransitionRef.current = { ...activeTransition, phase: 'idle' };
    pending.execute(true);
  }, [cancelPending, isActive, topRoute, transition]);

  const resetAfterOutgoingGestureCancel = useCallback(() => {
    if (!optionsRef.current?.rootTabsTransition) {
      localTransitionRef.current = {
        cycle: localTransitionRef.current.cycle + 1,
        phase: 'idle',
      };
    }
    cancelPending();
  }, [cancelPending]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled)
      return () => {
        mountedRef.current = false;
        cancelPending();
      };

    const removeFocus = navigation.addListener('focus', () => {
      tryFlushPending();
    });
    const removeBlur = navigation.addListener('blur', cancelPending);
    const removeGestureCancel = navigation.addListener('gestureCancel', () => {
      if (!rootTabsTransition) {
        localTransitionRef.current = {
          cycle: localTransitionRef.current.cycle + 1,
          phase: 'idle',
        };
      }
      cancelPending();
      cancelPendingReturnIntentsForGestureCancelledRoute(sourceRouteName);
    });
    const removeState = navigation.addListener('state', () => {
      tryFlushPending();
    });
    const removeNativeTransitionStart = rootTabsTransition
      ? () => undefined
      : navigation.addListener('transitionStart', ({ data }) => {
          if (!data.closing) {
            if (pendingRef.current) cancelPending();
            localTransitionRef.current = {
              cycle: localTransitionRef.current.cycle + 1,
              phase: 'entering',
            };
            return;
          }
          localTransitionRef.current = {
            ...localTransitionRef.current,
            phase: 'leaving',
          };
          cancelPending();
        });
    const removeNativeTransitionEnd = rootTabsTransition
      ? () => undefined
      : navigation.addListener('transitionEnd', ({ data }) => {
          if (data.closing) {
            localTransitionRef.current = {
              ...localTransitionRef.current,
              phase: 'idle',
            };
            cancelPending();
            return;
          }
          if (localTransitionRef.current.phase === 'entering') {
            localTransitionRef.current = {
              ...localTransitionRef.current,
              phase: 'settled',
            };
          }
          tryFlushPending();
        });
    const removeRootTransition = rootTabsTransition
      ? subscribeToRootTabsTransitionChanges((next) => {
          if (next.phase === 'leaving' || next.phase === 'idle') {
            cancelPending();
            return;
          }
          if (
            next.phase === 'entering' &&
            pendingRef.current &&
            pendingRef.current.cycle !== next.cycle
          ) {
            cancelPending();
          }
          tryFlushPending();
        })
      : () => undefined;
    const removeOutgoingGestureCancellation = registerGestureCancellationForOutgoingRoutes(
      optionsRef.current?.expectedOutgoingRouteNames ?? [],
      resetAfterOutgoingGestureCancel,
    );

    return () => {
      mountedRef.current = false;
      removeFocus();
      removeBlur();
      removeGestureCancel();
      removeState();
      removeNativeTransitionStart();
      removeNativeTransitionEnd();
      removeRootTransition();
      removeOutgoingGestureCancellation();
      cancelPending();
    };
  }, [
    cancelPending,
    enabled,
    navigation,
    rootTabsTransition,
    outgoingRouteRegistrationKey,
    sourceRouteName,
    transition,
    tryFlushPending,
    resetAfterOutgoingGestureCancel,
  ]);

  return useCallback(
    (request: ReturnIntentRequest): ReturnIntentDecision => {
      const current = optionsRef.current;
      if (!enabled || !current) return 'blocked';

      const activeTransition = transition();
      const sourceIsActive = isActive();
      if (
        sourceIsActive &&
        activeTransition.phase !== 'entering' &&
        activeTransition.phase !== 'leaving'
      ) {
        if (pendingRef.current) cancelPending();
        request.execute(false);
        return 'executed';
      }

      const routeName = topRoute();
      const isReturnTransition =
        (activeTransition.phase === 'entering' || activeTransition.phase === 'settled') &&
        Boolean(routeName) &&
        (routeName === current.sourceRouteName ||
          current.expectedOutgoingRouteNames.includes(routeName ?? ''));
      if (!isReturnTransition) return 'blocked';

      const existing = pendingRef.current;
      if (existing?.key === request.key && existing.cycle === activeTransition.cycle) {
        existing.execute = request.execute;
        return 'consolidated';
      }
      if (existing) cancelPending();

      pendingRef.current = { ...request, cycle: activeTransition.cycle };
      return 'pending';
    },
    [cancelPending, enabled, isActive, topRoute, transition],
  );
}
