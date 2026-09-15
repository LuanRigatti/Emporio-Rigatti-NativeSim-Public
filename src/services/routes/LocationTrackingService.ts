import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import type {
  RouteTrackingRecord,
  RouteTrackingResult,
  RouteTrackingSession,
} from '@/types/routeTracking';
import type { RouteDistanceSummary } from './routeTrackingDistance';
import { isExpoGoRuntime } from '@/platform/runtimeEnvironment';

import { ROUTE_LOCATION_TASK_NAME } from './LocationTrackingTask';
import {
  routeTrackingRepository,
  type RouteTrackingSessionContext,
} from './RouteTrackingRepository';

export const routeLocationTaskOptions: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.High,
  activityType: Location.ActivityType.AutomotiveNavigation,
  deferredUpdatesDistance: 50,
  deferredUpdatesInterval: 30_000,
  distanceInterval: 25,
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
};

export type RouteTrackingErrorCode =
  | 'already-active'
  | 'background-unavailable'
  | 'location-disabled'
  | 'permission-denied'
  | 'session-expired'
  | 'session-required'
  | 'stop-failed'
  | 'unsupported';

export class RouteTrackingError extends Error {
  public readonly code: RouteTrackingErrorCode;

  public constructor(code: RouteTrackingErrorCode, message: string) {
    super(message);
    this.name = 'RouteTrackingError';
    this.code = code;
  }
}

export type LocationPermissionStatus = {
  foreground: Awaited<ReturnType<typeof Location.getForegroundPermissionsAsync>>;
  background: Awaited<ReturnType<typeof Location.getBackgroundPermissionsAsync>>;
};

export class LocationTrackingService {
  private stopQueue = Promise.resolve();

  public async startRouteTracking(routeId: string): Promise<RouteTrackingRecord> {
    const session = this.requireSession();
    const activeRoute = await routeTrackingRepository.getActiveRoute(session);
    this.assertCurrentSession(session);
    if (activeRoute) {
      if (activeRoute.routeId === routeId) {
        if (activeRoute.stopRequestedAt) {
          throw new RouteTrackingError(
            'stop-failed',
            'A parada da rota ainda não foi confirmada pelo sistema nativo.',
          );
        }
        const restored = await this.restoreActiveRouteAfterAppRestart(routeId, session);
        if (restored) return restored;
      }
      throw new RouteTrackingError(
        'already-active',
        'Já existe outra rota ativa. Finalize-a antes de iniciar uma nova.',
      );
    }

    await this.ensureReady(true);
    this.assertCurrentSession(session);
    if (await Location.hasStartedLocationUpdatesAsync(ROUTE_LOCATION_TASK_NAME)) {
      await Location.stopLocationUpdatesAsync(ROUTE_LOCATION_TASK_NAME);
      this.assertCurrentSession(session);
    }

    const route = await routeTrackingRepository.createActiveRoute(routeId, session);
    try {
      this.assertCurrentSession(session);
      await Location.startLocationUpdatesAsync(ROUTE_LOCATION_TASK_NAME, routeLocationTaskOptions);
      this.assertCurrentSession(session);
      return route;
    } catch (error) {
      await routeTrackingRepository.requestStop(routeId, Date.now(), session);
      throw error;
    }
  }

  public async stopRouteTracking(routeId: string): Promise<RouteTrackingRecord | null> {
    const session = routeTrackingRepository.getSessionContext();
    if (!session) return null;
    return this.enqueueStop(() => this.stopAndFinalizeRoute(routeId, session));
  }

  public async stopActiveRouteForLogout(
    ownerUid: string,
    sessionVersion: number,
  ): Promise<RouteTrackingRecord | null> {
    const session = routeTrackingRepository.getSessionContext();
    if (!session || session.uid !== ownerUid || session.sessionVersion !== sessionVersion) {
      throw new RouteTrackingError(
        'session-expired',
        'A sessão da rota expirou antes do logout ser concluído.',
      );
    }

    return this.enqueueStop(async () => {
      const activeRoute = await routeTrackingRepository.getActiveRoute(session);
      if (!activeRoute) return null;
      if (activeRoute.ownerUid !== ownerUid) {
        throw new RouteTrackingError('session-expired', 'A rota ativa pertence a outra sessão.');
      }
      return this.stopAndFinalizeRoute(activeRoute.routeId, session);
    });
  }

  public getActiveRoute(): Promise<RouteTrackingRecord | null> {
    return routeTrackingRepository.getActiveRoute();
  }

  public getRoute(): Promise<RouteTrackingRecord | null> {
    return routeTrackingRepository.getRoute();
  }

  public getRouteHistory(date?: string): Promise<RouteTrackingSession[]> {
    return routeTrackingRepository.getRouteHistory(date);
  }

  public getLatestCompletedRoute(): Promise<RouteTrackingSession | null> {
    return routeTrackingRepository.getLatestCompletedRoute();
  }

  public getRouteSessionById(routeId: string): Promise<RouteTrackingSession | null> {
    return routeTrackingRepository.getRouteSessionById(routeId);
  }

  public getRouteDistanceForDate(date: string): Promise<RouteDistanceSummary> {
    return routeTrackingRepository.getRouteDistanceForDate(date);
  }

  public getTotalDistanceForDate(date: string): Promise<number> {
    return routeTrackingRepository.getTotalDistanceForDate(date);
  }

  public removeRouteSession(sessionId: string): Promise<boolean> {
    return routeTrackingRepository.removeRouteSession(sessionId);
  }

  public async getPermissionStatus(): Promise<LocationPermissionStatus> {
    const foreground = await Location.getForegroundPermissionsAsync();
    const background = await Location.getBackgroundPermissionsAsync();

    return { background, foreground };
  }

  public async getTrackedDistance(routeId: string): Promise<number | null> {
    const session = this.requireSession();
    const route = await routeTrackingRepository.getRoute(session);
    this.assertCurrentSession(session);
    if (!route || route.routeId !== routeId || route.samples.length === 0) return null;
    return route.accumulatedDistanceMeters / 1000;
  }

  public async getRouteResult(routeId: string): Promise<RouteTrackingResult | null> {
    const session = this.requireSession();
    const route = await routeTrackingRepository.getRoute(session);
    this.assertCurrentSession(session);
    if (!route || route.routeId !== routeId || route.samples.length === 0) return null;

    return {
      durationSeconds: Math.max(
        0,
        ((route.endTimestamp ?? Date.now()) - route.startTimestamp) / 1000,
      ),
      endTimestamp: route.endTimestamp,
      kilometers: route.accumulatedDistanceMeters / 1000,
      routeId: route.routeId,
      startTimestamp: route.startTimestamp,
    };
  }

  public async restoreActiveRouteAfterAppRestart(
    routeId?: string,
    expectedSession?: RouteTrackingSessionContext,
  ): Promise<RouteTrackingRecord | null> {
    const session = expectedSession ?? this.requireSession();
    const activeRoute = await routeTrackingRepository.getActiveRoute(session);
    this.assertCurrentSession(session);
    if (!activeRoute) {
      const hasStartedTask =
        await Location.hasStartedLocationUpdatesAsync(ROUTE_LOCATION_TASK_NAME);
      this.assertCurrentSession(session);
      if (hasStartedTask) {
        await Location.stopLocationUpdatesAsync(ROUTE_LOCATION_TASK_NAME);
        this.assertCurrentSession(session);
      }
      return null;
    }
    if (routeId && activeRoute.routeId !== routeId) {
      throw new RouteTrackingError('already-active', 'Existe outra rota ativa neste dispositivo.');
    }

    if (activeRoute.stopRequestedAt) {
      return this.enqueueStop(() => this.stopAndFinalizeRoute(activeRoute.routeId, session));
    }

    await this.ensureReady(false);
    this.assertCurrentSession(session);
    if (!(await Location.hasStartedLocationUpdatesAsync(ROUTE_LOCATION_TASK_NAME))) {
      await Location.startLocationUpdatesAsync(ROUTE_LOCATION_TASK_NAME, routeLocationTaskOptions);
      this.assertCurrentSession(session);
    }
    return activeRoute;
  }

  private async stopAndFinalizeRoute(
    routeId: string,
    session: RouteTrackingSessionContext,
  ): Promise<RouteTrackingRecord | null> {
    const current = await routeTrackingRepository.getRoute(session);
    this.assertCurrentSession(session);
    if (!current) return null;
    if (current.routeId !== routeId) {
      if (current.active) {
        throw new RouteTrackingError(
          'already-active',
          'A rota ativa atual é diferente da rota informada.',
        );
      }
      return null;
    }
    if (!current.active) return current;

    await routeTrackingRepository.requestStop(routeId, Date.now(), session);
    this.assertCurrentSession(session);

    try {
      if (await Location.hasStartedLocationUpdatesAsync(ROUTE_LOCATION_TASK_NAME)) {
        await Location.stopLocationUpdatesAsync(ROUTE_LOCATION_TASK_NAME);
      }
      this.assertCurrentSession(session);

      if (await Location.hasStartedLocationUpdatesAsync(ROUTE_LOCATION_TASK_NAME)) {
        throw new Error('O sistema nativo ainda informa atualizações de localização ativas.');
      }
    } catch (error) {
      if (error instanceof RouteTrackingError && error.code === 'session-expired') {
        throw error;
      }
      throw new RouteTrackingError(
        'stop-failed',
        'Não foi possível confirmar a parada do rastreamento nativo. A rota continua ativa para nova tentativa.',
      );
    }

    return routeTrackingRepository.finishRoute(routeId, Date.now(), session);
  }

  private requireSession(): RouteTrackingSessionContext {
    const session = routeTrackingRepository.getSessionContext();
    if (!session) {
      throw new RouteTrackingError(
        'session-required',
        'Uma sessão autenticada é necessária para rastrear rotas.',
      );
    }
    return session;
  }

  private assertCurrentSession(session: RouteTrackingSessionContext): void {
    if (!routeTrackingRepository.isSessionCurrent(session)) {
      throw new RouteTrackingError('session-expired', 'A sessão da rota expirou.');
    }
  }

  private enqueueStop<T>(work: () => Promise<T>): Promise<T> {
    const next = this.stopQueue.then(work);
    this.stopQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async ensureReady(requestPermissions: boolean): Promise<void> {
    if (Platform.OS !== 'ios' || isExpoGoRuntime()) {
      throw new RouteTrackingError(
        'unsupported',
        'O rastreamento em segundo plano exige um Development Build iOS.',
      );
    }
    if (
      !(await TaskManager.isAvailableAsync()) ||
      !(await Location.isBackgroundLocationAvailableAsync())
    ) {
      throw new RouteTrackingError(
        'background-unavailable',
        'O rastreamento em segundo plano não está disponível neste dispositivo.',
      );
    }
    if (!(await Location.hasServicesEnabledAsync())) {
      throw new RouteTrackingError(
        'location-disabled',
        'Ative os Serviços de Localização para iniciar a rota.',
      );
    }

    let foreground = await Location.getForegroundPermissionsAsync();
    if (!foreground.granted && requestPermissions) {
      foreground = await Location.requestForegroundPermissionsAsync();
    }
    if (!foreground.granted) {
      throw new RouteTrackingError(
        'permission-denied',
        'Permita o acesso à localização durante o uso para iniciar a rota.',
      );
    }

    let background = await Location.getBackgroundPermissionsAsync();
    if (!background.granted && requestPermissions) {
      background = await Location.requestBackgroundPermissionsAsync();
    }
    if (!background.granted) {
      throw new RouteTrackingError(
        'permission-denied',
        'Permita o acesso à localização Sempre para acompanhar a rota em segundo plano.',
      );
    }
  }
}

export const locationTrackingService = new LocationTrackingService();
