import { useNavigation, useRouter, type NativeStackNavigationProp } from 'expo-router';
import { useEffect, useLayoutEffect, useRef } from 'react';

import { triggerLightImpactHaptic } from '@/utils/haptics';
import { usePendingReturnNavigationIntent } from '@/utils/navigation/usePendingReturnNavigationIntent';
import { getNavigationTopRoute } from '@/utils/navigation/navigationTopRoute';

type ChartRoute = 'faturamento-mensal' | 'lucro-liquido-mensal';
type Navigation = NativeStackNavigationProp<Record<string, object | undefined>>;

export function useWholesaleChartNavigation(
  period: string,
  canOpenRevenue: boolean,
  canOpenNetProfit: boolean,
) {
  const router = useRouter();
  const navigation = useNavigation<Navigation>();
  const rootNavigation = useNavigation<Navigation>('/');
  const openingRef = useRef(false);
  const selection = { period, canOpenRevenue, canOpenNetProfit };
  const selectionRef = useRef(selection);
  useLayoutEffect(() => {
    selectionRef.current = { period, canOpenRevenue, canOpenNetProfit };
  }, [period, canOpenRevenue, canOpenNetProfit]);

  const getRootRoute = () => getNavigationTopRoute(rootNavigation);
  const isFinanceTabSelected = () => {
    const tabsState = navigation.getParent()?.getState();
    return tabsState?.routes[tabsState.index]?.name === 'financeiro';
  };
  const isSourceActive = () => navigation.isFocused() && getRootRoute() === '(tabs)';
  const requestNavigationIntent = usePendingReturnNavigationIntent({
    expectedOutgoingRouteNames: ['faturamento-mensal', 'lucro-liquido-mensal'],
    getCurrentRouteName: () => (isFinanceTabSelected() ? getRootRoute() : undefined),
    isSourceActive,
    navigation,
    rootTabsTransition: true,
    sourceRouteName: '(tabs)',
  });

  useEffect(() => {
    const removeBlur = navigation.addListener('blur', () => {
      openingRef.current = false;
    });
    const removeState = rootNavigation.addListener('state', () => {
      if (getNavigationTopRoute(rootNavigation) !== '(tabs)') openingRef.current = false;
    });
    return () => {
      removeBlur();
      removeState();
      openingRef.current = false;
    };
  }, [navigation, rootNavigation]);

  return (route: ChartRoute) => {
    const isAvailable = () => {
      const current = selectionRef.current;
      return (
        isFinanceTabSelected() &&
        current.period === period &&
        (route === 'faturamento-mensal' ? current.canOpenRevenue : current.canOpenNetProfit)
      );
    };
    if (!isAvailable()) return;

    if (openingRef.current) {
      return;
    }

    requestNavigationIntent({
      key: `${route}:${period}`,
      execute: () => {
        if (!isAvailable()) {
          return;
        }

        // The router queues the action before focus/state change. Claim this tap synchronously.
        openingRef.current = true;
        try {
          triggerLightImpactHaptic();
          router.navigate({ pathname: `/${route}`, params: { period } });
        } catch (error) {
          openingRef.current = false;
          throw error;
        }
      },
    });
  };
}
