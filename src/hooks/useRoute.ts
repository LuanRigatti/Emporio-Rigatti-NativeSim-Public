import { useCallback, useState } from 'react';

import { useAuth } from '@/providers';
import {
  locationTrackingService,
  routeOptimizationService,
  routeSessionStore,
} from '@/services/routes';
import { createExpenseMutationService } from '@/services/expenses';
import { DeliveryMutationService } from '@/services/deliveries/DeliveryMutationService';
import type { UserDataSnapshot } from '@/services/data';
import type { Delivery } from '@/types/data';
import type { RouteCoordinate, RoutePlanDraft, RouteSession } from '@/types/route';

export function useRoute(initialSessionId?: string) {
  const { user } = useAuth();
  const [session, setSession] = useState<RouteSession | null>(() =>
    initialSessionId ? (routeSessionStore.get(initialSessionId) ?? null) : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const create = useCallback(
    async (
      plan: RoutePlanDraft,
      deliveries: readonly Delivery[],
      snapshot: UserDataSnapshot,
      manualCoordinates: Readonly<Record<string, RouteCoordinate>> = {},
      addressOverrides: Readonly<Record<string, string>> = {},
    ) => {
      setLoading(true);
      setError(undefined);
      try {
        const nextSession = await routeOptimizationService.createSession(
          plan,
          deliveries,
          snapshot.clientesCustom,
          manualCoordinates,
          addressOverrides,
        );
        setSession(nextSession);
        return nextSession;
      } catch (routeError) {
        const message =
          routeError instanceof Error ? routeError.message : 'Não foi possível calcular a rota.';
        setError(message);
        throw routeError;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const recreate = useCallback(
    async (
      currentSession: RouteSession,
      manualCoordinates: Readonly<Record<string, RouteCoordinate>>,
      addressOverrides: Readonly<Record<string, string>>,
    ) => {
      setLoading(true);
      setError(undefined);
      try {
        const nextSession = await routeOptimizationService.recreateSession(
          currentSession,
          manualCoordinates,
          addressOverrides,
        );
        setSession(nextSession);
        return nextSession;
      } catch (routeError) {
        setError(
          routeError instanceof Error ? routeError.message : 'Não foi possível recalcular a rota.',
        );
        throw routeError;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const markDelivered = useCallback(
    async (deliveryId: string) => {
      if (!user || !session) throw new Error('Sessão de rota não disponível.');
      await new DeliveryMutationService(user.id).setDelivered(deliveryId, true);
      const nextStops = session.stops.map((stop) =>
        stop.deliveryId === deliveryId ? { ...stop, delivered: true } : stop,
      );
      const nextSession = {
        ...session,
        stops: nextStops,
        status: 'inProgress' as const,
      };
      routeSessionStore.update(nextSession);
      setSession(nextSession);
      return nextSession;
    },
    [session, user],
  );

  const advance = useCallback(async () => {
    if (!session) return undefined;
    const nextIndex = Math.min(session.currentStopIndex + 1, Math.max(session.stops.length - 1, 0));
    const nextSession: RouteSession = {
      ...session,
      currentStopIndex: nextIndex,
      status: nextIndex >= session.stops.length - 1 ? 'completed' : 'inProgress',
    };
    routeSessionStore.update(nextSession);
    setSession(nextSession);
    if (nextSession.status === 'completed') {
      await locationTrackingService.stopRouteTracking(nextSession.id);
    }
    return nextSession;
  }, [session]);

  const saveDistance = useCallback(
    async (currentSession: RouteSession) => {
      if (!user) throw new Error('Sessão não disponível.');
      await createExpenseMutationService(user.id).saveRouteKilometers(
        currentSession.plan.date,
        currentSession.summary.distanceKm,
      );
    },
    [user],
  );

  const getSession = useCallback((sessionId: string) => routeSessionStore.get(sessionId), []);
  const loadSession = useCallback((sessionId: string) => {
    const stored = routeSessionStore.get(sessionId);
    if (stored) setSession(stored);
    return stored;
  }, []);

  return {
    session,
    loading,
    error,
    create,
    recreate,
    markDelivered,
    advance,
    saveDistance,
    getSession,
    loadSession,
  };
}
