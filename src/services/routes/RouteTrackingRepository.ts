import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as Location from 'expo-location';

import type { RouteTrackingRecord, RouteTrackingSession } from '@/types/routeTracking';

import { appendValidLocationSamples } from './routeTrackingMath';
import { getRouteDateKey } from './routeTrackingDates';
import { summarizeRouteDistance, type RouteDistanceSummary } from './routeTrackingDistance';
import { subscribeToRouteTrackingSession } from './RouteTrackingSessionBridge';

export const ROUTE_TRACKING_STORAGE_KEY = '@pareact/route-tracking-v1';
export const ROUTE_TRACKING_HISTORY_STORAGE_KEY = '@pareact/route-tracking-history-v1';
export const ROUTE_TRACKING_V2_STORAGE_PREFIX = '@pareact/route-tracking-v2:';
export const ROUTE_TRACKING_HISTORY_V2_STORAGE_PREFIX = '@pareact/route-tracking-history-v2:';
export const ROUTE_TRACKING_BACKGROUND_OWNER_STORAGE_KEY =
  '@pareact/route-tracking-v2:background-owner';

export function getRouteTrackingStorageKey(uid: string): string {
  return `${ROUTE_TRACKING_V2_STORAGE_PREFIX}${encodeURIComponent(uid)}`;
}

export function getRouteTrackingHistoryStorageKey(uid: string): string {
  return `${ROUTE_TRACKING_HISTORY_V2_STORAGE_PREFIX}${encodeURIComponent(uid)}`;
}

export type RouteTrackingSessionContext = {
  uid: string;
  sessionVersion: number;
  sessionKey: string;
};

type BackgroundOwner = {
  ownerUid: string;
  routeId: string;
};

function createSessionKey(uid: string, sessionVersion: number): string {
  return `${uid}\u0000${sessionVersion}`;
}

function createSessionContext(uid: string, sessionVersion: number): RouteTrackingSessionContext {
  return {
    sessionKey: createSessionKey(uid, sessionVersion),
    sessionVersion,
    uid,
  };
}

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

function parseStoredRecord(
  value: string | null,
  expectedOwnerUid?: string,
): RouteTrackingRecord | null {
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

    const ownerUid = typeof parsed.ownerUid === 'string' ? parsed.ownerUid.trim() : undefined;
    if (expectedOwnerUid && ownerUid !== expectedOwnerUid) return null;

    return {
      active: parsed.active,
      accumulatedDistanceMeters: parsed.accumulatedDistanceMeters,
      endTimestamp: typeof parsed.endTimestamp === 'number' ? parsed.endTimestamp : undefined,
      ownerUid,
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

function parseStoredHistory(
  value: string | null,
  expectedOwnerUid?: string,
): RouteTrackingSession[] {
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

      const ownerUid = typeof item.ownerUid === 'string' ? item.ownerUid.trim() : undefined;
      if (expectedOwnerUid && ownerUid !== expectedOwnerUid) return [];

      return [
        {
          date: item.date,
          distanceMeters: item.distanceMeters,
          durationSeconds: item.durationSeconds,
          endTimestamp: item.endTimestamp,
          id: item.id,
          ownerUid,
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

function compareSessionsForDeduplication(
  left: RouteTrackingSession,
  right: RouteTrackingSession,
): number {
  const leftCompleteness = [
    left.samples.length,
    left.pointsCount,
    Number.isFinite(left.endTimestamp) ? 1 : 0,
    Number.isFinite(left.distanceMeters) && left.distanceMeters >= 0 ? 1 : 0,
    Number.isFinite(left.durationSeconds) && left.durationSeconds >= 0 ? 1 : 0,
    left.date.trim() ? 1 : 0,
    left.status === 'finalized' ? 1 : 0,
  ];
  const rightCompleteness = [
    right.samples.length,
    right.pointsCount,
    Number.isFinite(right.endTimestamp) ? 1 : 0,
    Number.isFinite(right.distanceMeters) && right.distanceMeters >= 0 ? 1 : 0,
    Number.isFinite(right.durationSeconds) && right.durationSeconds >= 0 ? 1 : 0,
    right.date.trim() ? 1 : 0,
    right.status === 'finalized' ? 1 : 0,
  ];

  for (let index = 0; index < leftCompleteness.length; index += 1) {
    if (leftCompleteness[index] !== rightCompleteness[index]) {
      return leftCompleteness[index] > rightCompleteness[index] ? 1 : -1;
    }
  }

  if (left.endTimestamp !== right.endTimestamp) {
    return left.endTimestamp > right.endTimestamp ? 1 : -1;
  }
  if (left.startTimestamp !== right.startTimestamp) {
    return left.startTimestamp > right.startTimestamp ? 1 : -1;
  }

  const leftSignature = JSON.stringify(left);
  const rightSignature = JSON.stringify(right);
  if (leftSignature === rightSignature) return 0;
  return leftSignature > rightSignature ? 1 : -1;
}

function deduplicateRouteHistory(history: readonly RouteTrackingSession[]): RouteTrackingSession[] {
  const sessionsById = new Map<string, RouteTrackingSession>();

  for (const session of history) {
    const current = sessionsById.get(session.id);
    if (!current || compareSessionsForDeduplication(session, current) > 0) {
      sessionsById.set(session.id, session);
    }
  }

  return [...sessionsById.values()];
}

export class RouteTrackingRepository {
  private currentSession: RouteTrackingSessionContext | null = null;
  private readonly memoryHistoryBySession = new Map<string, RouteTrackingSession[]>();
  private readonly historyReads = new Map<string, Promise<RouteTrackingSession[]>>();
  private readonly historyEpochByUid = new Map<string, number>();
  // The native task has one active route per device. A single recovered queue
  // serializes all route mutations while each closure still carries its owner
  // UID/session context, so stale work cannot be reused by a new generation.
  private routeMutationQueue = Promise.resolve();

  public setSessionUser(uid: string | null | undefined, sessionVersion = 0): void {
    const normalizedUid = uid?.trim() || null;
    const nextSession = normalizedUid
      ? {
          sessionKey: createSessionKey(normalizedUid, sessionVersion),
          sessionVersion,
          uid: normalizedUid,
        }
      : null;

    if (
      this.currentSession?.uid === nextSession?.uid &&
      this.currentSession?.sessionVersion === nextSession?.sessionVersion
    ) {
      return;
    }

    this.currentSession = nextSession;
    this.memoryHistoryBySession.clear();
    this.historyReads.clear();
  }

  public getSessionContext(): RouteTrackingSessionContext | null {
    return this.currentSession;
  }

  public isSessionCurrent(context: RouteTrackingSessionContext): boolean {
    return this.currentSession?.sessionKey === context.sessionKey;
  }

  public getMemoryRouteHistory(date?: string): RouteTrackingSession[] | null {
    const session = this.currentSession;
    if (!session) return null;
    const history = this.memoryHistoryBySession.get(session.sessionKey);
    if (!history) return null;
    return date ? history.filter((item) => item.date === date) : history;
  }

  public getMemoryLatestCompletedRoute(): RouteTrackingSession | null {
    const history = this.getMemoryRouteHistory();
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  public clearMemoryCache(): void {
    this.memoryHistoryBySession.clear();
  }

  public async getRoute(
    expectedSession?: RouteTrackingSessionContext,
  ): Promise<RouteTrackingRecord | null> {
    const session = expectedSession ?? this.currentSession;
    if (!session) return null;

    const stored = await AsyncStorage.getItem(getRouteTrackingStorageKey(session.uid));
    if (!this.isSessionCurrent(session)) return null;
    return parseStoredRecord(stored, session.uid);
  }

  public async getActiveRoute(
    expectedSession?: RouteTrackingSessionContext,
  ): Promise<RouteTrackingRecord | null> {
    const route = await this.getRoute(expectedSession);
    return route?.active ? route : null;
  }

  public async getRouteHistory(
    date?: string,
    expectedSession?: RouteTrackingSessionContext,
  ): Promise<RouteTrackingSession[]> {
    const session = expectedSession ?? this.currentSession;
    if (!session) return [];

    const epoch = this.getHistoryEpoch(session.uid);
    const history = await this.readRouteHistory(session);
    if (!this.isSessionCurrent(session)) return [];
    if (epoch !== this.getHistoryEpoch(session.uid)) return this.getRouteHistory(date, session);

    this.memoryHistoryBySession.set(session.sessionKey, history);
    return date ? history.filter((item) => item.date === date) : history;
  }

  public getRouteHistoryForUser(
    uid: string,
    sessionVersion: number,
    date?: string,
  ): Promise<RouteTrackingSession[]> {
    const normalizedUid = uid.trim();
    if (!normalizedUid) return Promise.resolve([]);
    return this.getRouteHistory(date, createSessionContext(normalizedUid, sessionVersion));
  }

  public async getLatestCompletedRoute(
    expectedSession?: RouteTrackingSessionContext,
  ): Promise<RouteTrackingSession | null> {
    const history = await this.getRouteHistory(undefined, expectedSession);
    return history.length > 0 ? history[history.length - 1] : null;
  }

  public async getRouteSessionById(
    routeId: string,
    expectedSession?: RouteTrackingSessionContext,
  ): Promise<RouteTrackingSession | null> {
    const history = await this.getRouteHistory(undefined, expectedSession);
    return history.find((session) => session.id === routeId) ?? null;
  }

  public async getRouteDistanceForDate(
    date: string,
    expectedSession?: RouteTrackingSessionContext,
  ): Promise<RouteDistanceSummary> {
    return summarizeRouteDistance(await this.getRouteHistory(date, expectedSession));
  }

  public async getTotalDistanceForDate(
    date: string,
    expectedSession?: RouteTrackingSessionContext,
  ): Promise<number> {
    const summary = await this.getRouteDistanceForDate(date, expectedSession);
    return summary.totalKilometers;
  }

  public async removeRouteSession(
    sessionId: string,
    expectedSession?: RouteTrackingSessionContext,
  ): Promise<boolean> {
    const session = expectedSession ?? this.currentSession;
    if (!session) return false;

    return this.enqueueMutation(async () => {
      if (!this.isSessionCurrent(session)) return false;
      const storedHistory = await this.readStoredHistory(session.uid);
      if (!this.isSessionCurrent(session)) return false;

      const nextHistory = storedHistory.filter((item) => item.id !== sessionId);
      if (nextHistory.length === storedHistory.length) return false;

      await this.writeHistory(session, nextHistory);
      if (!this.isSessionCurrent(session)) return false;
      this.publishMemoryHistory(session, nextHistory);
      return true;
    });
  }

  public async createActiveRoute(
    routeId: string,
    expectedSession?: RouteTrackingSessionContext,
  ): Promise<RouteTrackingRecord> {
    const session = this.requireSession(expectedSession);

    return this.enqueueMutation(async () => {
      this.assertCurrentSession(session);
      const foreignOwner = await this.readBackgroundOwner();
      if (!this.isSessionCurrent(session)) throw new Error('A sessão da rota expirou.');
      if (foreignOwner && foreignOwner.ownerUid !== session.uid) {
        const foreignRoute = await this.readStoredRoute(foreignOwner.ownerUid);
        if (foreignRoute?.active && foreignRoute.routeId === foreignOwner.routeId) {
          throw new Error('Já existe uma rota ativa neste dispositivo.');
        }
        await this.clearBackgroundOwner();
      }

      const current = await this.readStoredRoute(session.uid);
      this.assertCurrentSession(session);
      if (current?.active) throw new Error('Já existe uma rota ativa.');

      const next: RouteTrackingRecord = {
        active: true,
        accumulatedDistanceMeters: 0,
        ownerUid: session.uid,
        routeId,
        samples: [],
        startTimestamp: Date.now(),
      };
      await this.writeRoute(session.uid, next);
      this.assertCurrentSession(session);
      await this.writeBackgroundOwner({ ownerUid: session.uid, routeId });
      this.assertCurrentSession(session);
      return next;
    });
  }

  public async appendLocationSamples(
    locations: readonly Location.LocationObject[],
    expectedSession?: RouteTrackingSessionContext,
  ): Promise<RouteTrackingRecord | null> {
    const session = expectedSession ?? this.currentSession;
    if (!session) return null;

    return this.enqueueMutation(async () => {
      if (!this.isSessionCurrent(session)) return null;
      const current = await this.readStoredRoute(session.uid);
      if (!this.isSessionCurrent(session)) return null;
      if (!current?.active || current.stopRequestedAt || current.ownerUid !== session.uid) {
        return current;
      }

      const next = appendValidLocationSamples(current, locations);
      await this.writeRoute(session.uid, next);
      if (!this.isSessionCurrent(session)) return null;
      return next;
    });
  }

  public async appendLocationSamplesForBackground(
    locations: readonly Location.LocationObject[],
  ): Promise<RouteTrackingRecord | null> {
    const owner = await this.readBackgroundOwner();
    if (!owner) return null;

    return this.enqueueMutation(async () => {
      const currentOwner = await this.readBackgroundOwner();
      if (
        !currentOwner ||
        currentOwner.ownerUid !== owner.ownerUid ||
        currentOwner.routeId !== owner.routeId
      ) {
        return null;
      }

      const current = await this.readStoredRoute(owner.ownerUid);
      if (
        !current ||
        !current.active ||
        current.stopRequestedAt ||
        current.ownerUid !== owner.ownerUid ||
        current.routeId !== owner.routeId
      ) {
        return null;
      }

      const currentRouteLocations = locations.filter(
        (location) =>
          Number.isFinite(location.timestamp) && location.timestamp >= current.startTimestamp,
      );
      if (currentRouteLocations.length === 0) return current;

      const next = appendValidLocationSamples(current, currentRouteLocations);
      if (
        next.samples.length === current.samples.length &&
        next.accumulatedDistanceMeters === current.accumulatedDistanceMeters
      ) {
        return current;
      }

      await this.writeRoute(owner.ownerUid, next);
      return next;
    });
  }

  public async requestStop(
    routeId: string,
    requestedAt = Date.now(),
    expectedSession?: RouteTrackingSessionContext,
  ): Promise<RouteTrackingRecord | null> {
    const session = expectedSession ?? this.currentSession;
    if (!session) return null;

    return this.enqueueMutation(async () => {
      if (!this.isSessionCurrent(session)) return null;
      const current = await this.readStoredRoute(session.uid);
      if (!this.isSessionCurrent(session)) return null;
      if (
        !current ||
        current.ownerUid !== session.uid ||
        current.routeId !== routeId ||
        !current.active ||
        current.stopRequestedAt
      ) {
        return current;
      }

      const stopping = { ...current, stopRequestedAt: requestedAt };
      await this.writeRoute(session.uid, stopping);
      if (!this.isSessionCurrent(session)) return null;
      return stopping;
    });
  }

  public async finishRoute(
    routeId: string,
    endTimestamp = Date.now(),
    expectedSession?: RouteTrackingSessionContext,
  ): Promise<RouteTrackingRecord | null> {
    const session = expectedSession ?? this.currentSession;
    if (!session) return null;

    return this.enqueueMutation(async () => {
      if (!this.isSessionCurrent(session)) return null;
      const current = await this.readStoredRoute(session.uid);
      if (!this.isSessionCurrent(session)) return null;
      if (!current || current.ownerUid !== session.uid || current.routeId !== routeId) {
        return current;
      }
      if (current.active && !current.stopRequestedAt) {
        throw new Error('A rota precisa ter a parada nativa confirmada antes da finalizacao.');
      }

      const finished = current.active ? { ...current, active: false, endTimestamp } : current;
      if (current.active) {
        await this.writeRoute(session.uid, finished);
        if (!this.isSessionCurrent(session)) return null;
      }

      const storedHistory = await this.readStoredHistory(session.uid);
      if (!this.isSessionCurrent(session)) return null;
      const history = deduplicateRouteHistory(storedHistory);
      const routeSession: RouteTrackingSession = {
        date: getRouteDateKey(finished.startTimestamp),
        distanceMeters: finished.accumulatedDistanceMeters,
        durationSeconds: Math.max(
          0,
          ((finished.endTimestamp ?? endTimestamp) - finished.startTimestamp) / 1000,
        ),
        endTimestamp: finished.endTimestamp ?? endTimestamp,
        id: finished.routeId,
        ownerUid: session.uid,
        pointsCount: finished.samples.length,
        samples: finished.samples,
        startTimestamp: finished.startTimestamp,
        status: 'finalized',
      };

      if (!history.some((item) => item.id === routeSession.id)) {
        const nextHistory = [...storedHistory, routeSession];
        await this.writeHistory(session, nextHistory);
        if (!this.isSessionCurrent(session)) return null;
        this.publishMemoryHistory(session, nextHistory);
      }

      await this.clearBackgroundOwnerIfMatches(session.uid, routeId);
      return finished;
    });
  }

  public async getBackgroundOwner(): Promise<BackgroundOwner | null> {
    return this.readBackgroundOwner();
  }

  private requireSession(
    expectedSession?: RouteTrackingSessionContext,
  ): RouteTrackingSessionContext {
    const session = expectedSession ?? this.currentSession;
    if (!session) throw new Error('Uma sessão autenticada é necessária para rastrear rotas.');
    return session;
  }

  private assertCurrentSession(context: RouteTrackingSessionContext): void {
    if (!this.isSessionCurrent(context)) throw new Error('A sessão da rota expirou.');
  }

  private async readStoredRoute(uid: string): Promise<RouteTrackingRecord | null> {
    return parseStoredRecord(await AsyncStorage.getItem(getRouteTrackingStorageKey(uid)), uid);
  }

  private async writeRoute(uid: string, route: RouteTrackingRecord): Promise<void> {
    await AsyncStorage.setItem(getRouteTrackingStorageKey(uid), JSON.stringify(route));
  }

  private async readStoredHistory(uid: string): Promise<RouteTrackingSession[]> {
    return parseStoredHistory(
      await AsyncStorage.getItem(getRouteTrackingHistoryStorageKey(uid)),
      uid,
    ).sort((left, right) => left.startTimestamp - right.startTimestamp);
  }

  private async readRouteHistory(
    session: RouteTrackingSessionContext,
  ): Promise<RouteTrackingSession[]> {
    const existing = this.historyReads.get(session.sessionKey);
    if (existing) return existing;

    const promise = this.readStoredHistory(session.uid)
      .then((history) => {
        if (!this.isSessionCurrent(session)) return [];
        return deduplicateRouteHistory(history).sort(
          (left, right) => left.startTimestamp - right.startTimestamp,
        );
      })
      .finally(() => {
        if (this.historyReads.get(session.sessionKey) === promise) {
          this.historyReads.delete(session.sessionKey);
        }
      });
    this.historyReads.set(session.sessionKey, promise);
    return promise;
  }

  private publishMemoryHistory(
    session: RouteTrackingSessionContext,
    history: readonly RouteTrackingSession[],
  ): void {
    this.memoryHistoryBySession.set(
      session.sessionKey,
      deduplicateRouteHistory(history).sort(
        (left, right) => left.startTimestamp - right.startTimestamp,
      ),
    );
  }

  private getHistoryEpoch(uid: string): number {
    return this.historyEpochByUid.get(uid) ?? 0;
  }

  private invalidateHistoryReads(uid: string): void {
    this.historyEpochByUid.set(uid, this.getHistoryEpoch(uid) + 1);
    for (const sessionKey of this.historyReads.keys()) {
      if (sessionKey.startsWith(`${uid}\u0000`)) this.historyReads.delete(sessionKey);
    }
  }

  private async writeHistory(
    session: RouteTrackingSessionContext,
    history: readonly RouteTrackingSession[],
  ): Promise<void> {
    this.invalidateHistoryReads(session.uid);
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey(session.uid),
      JSON.stringify(history),
    );
    this.invalidateHistoryReads(session.uid);
  }

  private async readBackgroundOwner(): Promise<BackgroundOwner | null> {
    const stored = await AsyncStorage.getItem(ROUTE_TRACKING_BACKGROUND_OWNER_STORAGE_KEY);
    if (!stored) return null;
    try {
      const parsed: unknown = JSON.parse(stored);
      if (!isRecord(parsed)) return null;
      if (
        typeof parsed.ownerUid !== 'string' ||
        !parsed.ownerUid ||
        typeof parsed.routeId !== 'string'
      ) {
        return null;
      }
      return { ownerUid: parsed.ownerUid, routeId: parsed.routeId };
    } catch {
      return null;
    }
  }

  private async writeBackgroundOwner(owner: BackgroundOwner): Promise<void> {
    await AsyncStorage.setItem(ROUTE_TRACKING_BACKGROUND_OWNER_STORAGE_KEY, JSON.stringify(owner));
  }

  private async clearBackgroundOwner(): Promise<void> {
    await AsyncStorage.removeItem(ROUTE_TRACKING_BACKGROUND_OWNER_STORAGE_KEY);
  }

  private async clearBackgroundOwnerIfMatches(ownerUid: string, routeId: string): Promise<void> {
    const owner = await this.readBackgroundOwner();
    if (owner?.ownerUid === ownerUid && owner.routeId === routeId) {
      await this.clearBackgroundOwner();
    }
  }

  private enqueueMutation<T>(work: () => Promise<T>): Promise<T> {
    const next = this.routeMutationQueue.then(work);
    this.routeMutationQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}

export const routeTrackingRepository = new RouteTrackingRepository();
subscribeToRouteTrackingSession(({ uid, sessionVersion }) => {
  routeTrackingRepository.setSessionUser(uid, sessionVersion);
});
