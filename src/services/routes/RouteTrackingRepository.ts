import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as Location from 'expo-location';

import type { RouteTrackingRecord } from '@/types/routeTracking';

import { appendValidLocationSamples } from './routeTrackingMath';

export const ROUTE_TRACKING_STORAGE_KEY = '@pareact/route-tracking-v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStoredRecord(value: string | null): RouteTrackingRecord | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return null;

    const samples = Array.isArray(parsed.samples)
      ? parsed.samples.filter((sample): sample is RouteTrackingRecord['samples'][number] => {
          if (!isRecord(sample)) return false;
          return (
            typeof sample.latitude === 'number' &&
            typeof sample.longitude === 'number' &&
            typeof sample.accuracy === 'number' &&
            typeof sample.timestamp === 'number'
          );
        })
      : [];

    if (
      typeof parsed.routeId !== 'string' ||
      typeof parsed.startTimestamp !== 'number' ||
      typeof parsed.active !== 'boolean' ||
      typeof parsed.accumulatedDistanceMeters !== 'number' ||
      (parsed.stopRequestedAt !== undefined &&
        (typeof parsed.stopRequestedAt !== 'number' || !Number.isFinite(parsed.stopRequestedAt))) ||
      !Number.isFinite(parsed.startTimestamp) ||
      !Number.isFinite(parsed.accumulatedDistanceMeters) ||
      parsed.accumulatedDistanceMeters < 0
    ) {
      return null;
    }

    return {
      active: parsed.active,
      accumulatedDistanceMeters: parsed.accumulatedDistanceMeters,
      endTimestamp: typeof parsed.endTimestamp === 'number' ? parsed.endTimestamp : undefined,
      routeId: parsed.routeId,
      samples,
      startTimestamp: parsed.startTimestamp,
      stopRequestedAt:
        typeof parsed.stopRequestedAt === 'number' ? parsed.stopRequestedAt : undefined,
    };
  } catch {
    return null;
  }
}

export class RouteTrackingRepository {
  private writeQueue = Promise.resolve();

  public async getRoute(): Promise<RouteTrackingRecord | null> {
    return parseStoredRecord(await AsyncStorage.getItem(ROUTE_TRACKING_STORAGE_KEY));
  }

  public async getActiveRoute(): Promise<RouteTrackingRecord | null> {
    const route = await this.getRoute();
    return route?.active ? route : null;
  }

  public async createActiveRoute(routeId: string): Promise<RouteTrackingRecord> {
    return this.enqueue(async () => {
      const current = await this.getRoute();
      if (current?.active) throw new Error('Já existe uma rota ativa.');

      const next: RouteTrackingRecord = {
        active: true,
        accumulatedDistanceMeters: 0,
        routeId,
        samples: [],
        startTimestamp: Date.now(),
      };
      await this.write(next);
      return next;
    });
  }

  public async appendLocationSamples(
    locations: readonly Location.LocationObject[],
  ): Promise<RouteTrackingRecord | null> {
    return this.enqueue(async () => {
      const current = await this.getActiveRoute();
      if (!current || current.stopRequestedAt) return current;

      const next = appendValidLocationSamples(current, locations);
      await this.write(next);
      return next;
    });
  }

  public async requestStop(
    routeId: string,
    requestedAt = Date.now(),
  ): Promise<RouteTrackingRecord | null> {
    return this.enqueue(async () => {
      const current = await this.getRoute();
      if (!current || current.routeId !== routeId || !current.active || current.stopRequestedAt) {
        return current;
      }

      const stopping = { ...current, stopRequestedAt: requestedAt };
      await this.write(stopping);
      return stopping;
    });
  }

  public async finishRoute(
    routeId: string,
    endTimestamp = Date.now(),
  ): Promise<RouteTrackingRecord | null> {
    return this.enqueue(async () => {
      const current = await this.getRoute();
      if (!current || current.routeId !== routeId) return current;
      if (current.active && !current.stopRequestedAt) {
        throw new Error('A rota precisa ter a parada nativa confirmada antes da finalizacao.');
      }

      const finished = { ...current, active: false, endTimestamp };
      await this.write(finished);
      return finished;
    });
  }

  private async write(route: RouteTrackingRecord): Promise<void> {
    await AsyncStorage.setItem(ROUTE_TRACKING_STORAGE_KEY, JSON.stringify(route));
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.writeQueue.then(work);
    this.writeQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}

export const routeTrackingRepository = new RouteTrackingRepository();
