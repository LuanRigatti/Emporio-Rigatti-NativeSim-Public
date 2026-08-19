import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { routeTrackingRepository } from '@/services/routes';
import type { RouteTrackingSession } from '@/types/routeTracking';

export function useLatestCompletedRoute(): RouteTrackingSession | null {
  const [latestRoute, setLatestRoute] = useState<RouteTrackingSession | null>(() =>
    routeTrackingRepository.getMemoryLatestCompletedRoute(),
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void routeTrackingRepository
        .getLatestCompletedRoute()
        .then((session) => {
          if (active) {
            setLatestRoute(session);
          }
        })
        .catch(() => {
          // Mantém o estado atual em caso de falha de leitura
        });

      return () => {
        active = false;
      };
    }, []),
  );

  return latestRoute;
}
