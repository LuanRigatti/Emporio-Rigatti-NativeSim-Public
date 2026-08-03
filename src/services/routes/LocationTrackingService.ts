import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import type { RouteTrackingRecord, RouteTrackingResult } from '@/types/routeTracking';
import { isExpoGoRuntime } from '@/platform/runtimeEnvironment';

import { ROUTE_LOCATION_TASK_NAME } from './LocationTrackingTask';
import { routeTrackingRepository } from './RouteTrackingRepository';

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

function isAlwaysPermissionGranted(permission: Location.LocationPermissionResponse): boolean {
  return permission.granted && permission.ios?.scope === 'always';
}

export class LocationTrackingService {
  private stopQueue = Promise.resolve();

  public async startRouteTracking(routeId: string): Promise<RouteTrackingRecord> {
    const activeRoute = await routeTrackingRepository.getActiveRoute();
    if (activeRoute) {
      if (activeRoute.routeId === routeId) {
        if (activeRoute.stopRequestedAt) {
          throw new RouteTrackingError(
            'stop-failed',
            'A parada da rota ainda não foi confirmada pelo sistema nativo.',
          );
        }
        const restored = await this.restoreActiveRouteAfterAppRestart(routeId);
        if (restored) return restored;
      }
      throw new RouteTrackingError(
        'already-active',
        'Já existe outra rota ativa. Finalize-a antes de iniciar uma nova.',
      );
    }

    await this.ensureReady(true);
    if (await Location.hasStartedLocationUpdatesAsync(ROUTE_LOCATION_TASK_NAME)) {
      await Location.stopLocationUpdatesAsync(ROUTE_LOCATION_TASK_NAME);
    }

    const route = await routeTrackingRepository.createActiveRoute(routeId);
    try {
      await Location.startLocationUpdatesAsync(ROUTE_LOCATION_TASK_NAME, routeLocationTaskOptions);
      return route;
    } catch (error) {
      await routeTrackingRepository.requestStop(routeId);
      throw error;
    }
  }

  public async stopRouteTracking(routeId: string): Promise<RouteTrackingRecord | null> {
    return this.enqueueStop(() => this.stopAndFinalizeRoute(routeId));
  }

  public getActiveRoute(): Promise<RouteTrackingRecord | null> {
    return routeTrackingRepository.getActiveRoute();
  }

  public async getTrackedDistance(routeId: string): Promise<number | null> {
    const route = await routeTrackingRepository.getRoute();
    if (!route || route.routeId !== routeId || route.samples.length === 0) return null;
    return route.accumulatedDistanceMeters / 1000;
  }

  public async getRouteResult(routeId: string): Promise<RouteTrackingResult | null> {
    const route = await routeTrackingRepository.getRoute();
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
  ): Promise<RouteTrackingRecord | null> {
    const activeRoute = await routeTrackingRepository.getActiveRoute();
    if (!activeRoute) return null;
    if (routeId && activeRoute.routeId !== routeId) {
      throw new RouteTrackingError('already-active', 'Existe outra rota ativa neste dispositivo.');
    }

    if (activeRoute.stopRequestedAt) {
      return this.stopRouteTracking(activeRoute.routeId);
    }

    await this.ensureReady(false);
    if (!(await Location.hasStartedLocationUpdatesAsync(ROUTE_LOCATION_TASK_NAME))) {
      await Location.startLocationUpdatesAsync(ROUTE_LOCATION_TASK_NAME, routeLocationTaskOptions);
    }
    return activeRoute;
  }

  private async stopAndFinalizeRoute(routeId: string): Promise<RouteTrackingRecord | null> {
    const current = await routeTrackingRepository.getRoute();
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

    await routeTrackingRepository.requestStop(routeId);

    try {
      if (await Location.hasStartedLocationUpdatesAsync(ROUTE_LOCATION_TASK_NAME)) {
        await Location.stopLocationUpdatesAsync(ROUTE_LOCATION_TASK_NAME);
      }

      if (await Location.hasStartedLocationUpdatesAsync(ROUTE_LOCATION_TASK_NAME)) {
        throw new Error('O sistema nativo ainda informa atualizações de localização ativas.');
      }
    } catch {
      throw new RouteTrackingError(
        'stop-failed',
        'Não foi possível confirmar a parada do rastreamento nativo. A rota continua ativa para nova tentativa.',
      );
    }

    return routeTrackingRepository.finishRoute(routeId);
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

    let background =
      (await Location.getBackgroundPermissionsAsync()) as Location.LocationPermissionResponse;
    if (!isAlwaysPermissionGranted(background) && requestPermissions) {
      background =
        (await Location.requestBackgroundPermissionsAsync()) as Location.LocationPermissionResponse;
    }
    if (!isAlwaysPermissionGranted(background)) {
      throw new RouteTrackingError(
        'permission-denied',
        'Permita o acesso à localização Sempre para acompanhar a rota em segundo plano.',
      );
    }
  }
}

export const locationTrackingService = new LocationTrackingService();
