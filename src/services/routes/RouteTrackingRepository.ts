import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as Location from 'expo-location';

import type { RouteTrackingRecord, RouteTrackingSession } from '@/types/routeTracking';

import { appendValidLocationSamples } from './routeTrackingMath';
import { getRouteDateKey } from './routeTrackingDates';
import { summarizeRouteDistance, type RouteDistanceSummary } from './routeTrackingDistance';

export const ROUTE_TRACKING_STORAGE_KEY = '@pareact/route-tracking-v1';
export const ROUTE_TRACKING_HISTORY_STORAGE_KEY = '@pareact/route-tracking-history-v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSample(value: unknown): RouteTrackingRecord['samples'][number] | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.latitude !== 'number' ||
    typeof value.longitude !== 'number' ||
    typeof value.accuracy !== 'number' ||
    typeof value.timestamp !== 'number'
  ) {
    return null;
  }

  return {
    accuracy: value.accuracy,
    latitude: value.latitude,
    longitude: value.longitude,
    timestamp: value.timestamp,
  };
}

function parseSamples(value: unknown): RouteTrackingRecord['samples'] {
  return Array.isArray(value)
    ? value.flatMap((sample) => {
        const parsed = parseSample(sample);
        return parsed ? [parsed] : [];
      })
    : [];
}

function parseStoredRecord(value: string | null): RouteTrackingRecord | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return null;

    const samples = parseSamples(parsed.samples);

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

function parseStoredHistory(value: string | null): RouteTrackingSession[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item) => {
      if (!isRecord(item)) return [];
      const samples = parseSamples(item.samples);
      if (
        typeof item.id !== 'string' ||
        typeof item.date !== 'string' ||
        typeof item.startTimestamp !== 'number' ||
        typeof item.endTimestamp !== 'number' ||
        typeof item.durationSeconds !== 'number' ||
        typeof item.distanceMeters !== 'number' ||
        typeof item.pointsCount !== 'number' ||
        item.status !== 'finalized' ||
        !Number.isFinite(item.startTimestamp) ||
        !Number.isFinite(item.endTimestamp) ||
        !Number.isFinite(item.durationSeconds) ||
        !Number.isFinite(item.distanceMeters) ||
        !Number.isFinite(item.pointsCount) ||
        item.distanceMeters < 0 ||
        item.pointsCount < 0
      ) {
        return [];
      }

      return [
        {
          date: item.date,
          distanceMeters: item.distanceMeters,
          durationSeconds: item.durationSeconds,
          endTimestamp: item.endTimestamp,
          id: item.id,
          pointsCount: item.pointsCount,
          samples,
          startTimestamp: item.startTimestamp,
          status: 'finalized' as const,
        },
      ];
    });
  } catch {
    return [];
  }
}

export class RouteTrackingRepository {
  private writeQueue = Promise.resolve();
  private memoryHistory: RouteTrackingSession[] | null = null;

  public getMemoryRouteHistory(date?: string): RouteTrackingSession[] | null {
    if (this.memoryHistory === null) return null;
    return date
      ? this.memoryHistory.filter((session) => session.date === date)
      : this.memoryHistory;
  }

  public getMemoryLatestCompletedRoute(): RouteTrackingSession | null {
    if (!this.memoryHistory || this.memoryHistory.length === 0) return null;
    return this.memoryHistory[this.memoryHistory.length - 1];
  }

  public clearMemoryCache(): void {
    this.memoryHistory = null;
  }

  public async getRoute(): Promise<RouteTrackingRecord | null> {
    return parseStoredRecord(await AsyncStorage.getItem(ROUTE_TRACKING_STORAGE_KEY));
  }

  public async getActiveRoute(): Promise<RouteTrackingRecord | null> {
    const route = await this.getRoute();
    return route?.active ? route : null;
  }

  public async getRouteHistory(date?: string): Promise<RouteTrackingSession[]> {
    const history = parseStoredHistory(
      await AsyncStorage.getItem(ROUTE_TRACKING_HISTORY_STORAGE_KEY),
    ).sort((left, right) => left.startTimestamp - right.startTimestamp);

    this.memoryHistory = history;

    return date ? history.filter((session) => session.date === date) : history;
  }

  public async getLatestCompletedRoute(): Promise<RouteTrackingSession | null> {
    const history = await this.getRouteHistory();
    return history.length > 0 ? history[history.length - 1] : null;
  }

  public async getRouteSessionById(routeId: string): Promise<RouteTrackingSession | null> {
    const history = await this.getRouteHistory();
    return history.find((session) => session.id === routeId) ?? null;
  }

  public async getRouteDistanceForDate(date: string): Promise<RouteDistanceSummary> {
    return summarizeRouteDistance(await this.getRouteHistory(date));
  }

  public async getTotalDistanceForDate(date: string): Promise<number> {
    const summary = await this.getRouteDistanceForDate(date);
    return summary.totalKilometers;
  }

  public async removeRouteSession(sessionId: string): Promise<boolean> {
    return this.enqueue(async () => {
      const history = await this.getRouteHistory();
      const nextHistory = history.filter((session) => session.id !== sessionId);
      if (nextHistory.length === history.length) return false;

      this.memoryHistory = nextHistory;
      await AsyncStorage.setItem(ROUTE_TRACKING_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
      return true;
    });
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

      const finished = current.active ? { ...current, active: false, endTimestamp } : current;
      if (current.active) await this.write(finished);

      const history = await this.getRouteHistory();
      const session: RouteTrackingSession = {
        date: getRouteDateKey(finished.startTimestamp),
        distanceMeters: finished.accumulatedDistanceMeters,
        durationSeconds: Math.max(
          0,
          ((finished.endTimestamp ?? endTimestamp) - finished.startTimestamp) / 1000,
        ),
        endTimestamp: finished.endTimestamp ?? endTimestamp,
        id: finished.routeId,
        pointsCount: finished.samples.length,
        samples: finished.samples,
        startTimestamp: finished.startTimestamp,
        status: 'finalized',
      };

      if (!history.some((item) => item.id === session.id)) {
        const nextHistory = [...history, session];
        this.memoryHistory = nextHistory;
        await AsyncStorage.setItem(ROUTE_TRACKING_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
      }
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
