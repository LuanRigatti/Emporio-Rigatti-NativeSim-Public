import { usePathname, useRootNavigationState, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useInitialCacheHydration, useSession } from '@/providers';
import { getQuickActionRoute, nativeQuickActions } from '@/services/quick-actions';

type PendingQuickAction = {
  type: string;
};

export function QuickActionRouter() {
  const router = useRouter();
  const pathname = usePathname();
  const rootNavigationState = useRootNavigationState();
  const { status, user } = useSession();
  const isCacheHydrated = useInitialCacheHydration();
  const [pendingAction, setPendingAction] = useState<PendingQuickAction | null>(null);
  const handledActionRef = useRef<PendingQuickAction | null>(null);

  useEffect(() => {
    if (!nativeQuickActions) return;

    const subscription = nativeQuickActions.addListener('onQuickAction', ({ type }) => {
      setPendingAction({ type });
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (
      !pendingAction ||
      !rootNavigationState.key ||
      pathname === '/' ||
      pathname === '/login' ||
      status !== 'authenticated' ||
      !user?.id ||
      !isCacheHydrated
    ) {
      return;
    }
    if (handledActionRef.current === pendingAction) return;

    const route = getQuickActionRoute(pendingAction.type);
    handledActionRef.current = pendingAction;
    if (!route) return;

    router.push(route as Href);
  }, [isCacheHydrated, pathname, pendingAction, rootNavigationState.key, router, status, user?.id]);

  return null;
}
