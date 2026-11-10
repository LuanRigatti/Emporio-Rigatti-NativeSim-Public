import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UserDataSnapshot } from '@/services/data';

const CACHE_VERSION = 1;
const CACHE_PREFIX = '@pareact/financial-period-cache-v1';

export type FinancialAllTimeSnapshotCacheEntry = {
  cacheVersion: number;
  coverage: 'all';
  uid: string;
  sessionVersion: number;
  snapshot: UserDataSnapshot;
  remoteComplete: true;
  routesCoverage: 'local-only';
  cachedAt: number;
};

export type FinancialPeriodSnapshotCacheEntry = {
  cacheVersion: number;
  uid: string;
  displayMonth: string;
  snapshot: UserDataSnapshot;
  comparisonSnapshot: UserDataSnapshot;
  cachedAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSnapshot(value: unknown): value is UserDataSnapshot {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.entregas) &&
    isRecord(value.gastosDiarios) &&
    isRecord(value.gastosMensais) &&
    Array.isArray(value.recebimentoBaldes) &&
    isRecord(value.clientesCustom)
  );
}

function isValidEntry(value: unknown): value is FinancialPeriodSnapshotCacheEntry {
  if (!isRecord(value)) return false;
  return (
    value.cacheVersion === CACHE_VERSION &&
    typeof value.uid === 'string' &&
    typeof value.displayMonth === 'string' &&
    /^\d{4}-\d{2}$/.test(value.displayMonth) &&
    isSnapshot(value.snapshot) &&
    isSnapshot(value.comparisonSnapshot) &&
    typeof value.cachedAt === 'number'
  );
}

function isValidAllTimeEntry(value: unknown): value is FinancialAllTimeSnapshotCacheEntry {
  if (!isRecord(value)) return false;
  return (
    value.cacheVersion === CACHE_VERSION &&
    value.coverage === 'all' &&
    typeof value.uid === 'string' &&
    typeof value.sessionVersion === 'number' &&
    Number.isInteger(value.sessionVersion) &&
    isSnapshot(value.snapshot) &&
    value.remoteComplete === true &&
    value.routesCoverage === 'local-only' &&
    typeof value.cachedAt === 'number'
  );
}

export class FinancialPeriodSnapshotCache {
  private readonly memory = new Map<
    string,
    FinancialPeriodSnapshotCacheEntry | FinancialAllTimeSnapshotCacheEntry
  >();
  private readonly periodMemoryScopes = new Map<
    string,
    { sessionVersion: number; requestScopeKey: string }
  >();
  private readonly periodInvalidationVersions = new Map<string, number>();
  private readonly periodInvalidationListeners = new Map<
    string,
    Set<(displayMonth: string) => void>
  >();
  private readonly externalChangeListeners = new Map<string, Set<() => void>>();

  public getPeriodInvalidationVersion(uid: string, displayMonth: string): number {
    return this.periodInvalidationVersions.get(this.getKey(uid, displayMonth)) ?? 0;
  }

  public subscribeToPeriodInvalidation(
    uid: string,
    listener: (displayMonth: string) => void,
  ): () => void {
    const listeners = this.periodInvalidationListeners.get(uid) ?? new Set();
    listeners.add(listener);
    this.periodInvalidationListeners.set(uid, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.periodInvalidationListeners.delete(uid);
    };
  }

  public subscribeToExternalChange(uid: string, listener: () => void): () => void {
    const listeners = this.externalChangeListeners.get(uid) ?? new Set<() => void>();
    listeners.add(listener);
    this.externalChangeListeners.set(uid, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.externalChangeListeners.delete(uid);
    };
  }

  public notifyExternalChange(uid: string): void {
    this.externalChangeListeners.get(uid)?.forEach((listener) => listener());
  }

  public getKey(uid: string, displayMonth: string): string {
    return `${CACHE_PREFIX}:${uid}:${displayMonth}`;
  }

  public getAllTimeKey(uid: string, sessionVersion: number): string {
    return `${CACHE_PREFIX}:${uid}:session:${sessionVersion}:coverage:all`;
  }

  public getMemory(uid: string, displayMonth: string): FinancialPeriodSnapshotCacheEntry | null {
    const entry = this.memory.get(this.getKey(uid, displayMonth));
    return entry && isValidEntry(entry) ? entry : null;
  }

  public getMemoryForRequest(
    uid: string,
    displayMonth: string,
    sessionVersion: number,
    requestScopeKey: string,
  ): FinancialPeriodSnapshotCacheEntry | null {
    const key = this.getKey(uid, displayMonth);
    const entry = this.memory.get(key);
    const scope = this.periodMemoryScopes.get(key);
    return entry &&
      isValidEntry(entry) &&
      scope?.sessionVersion === sessionVersion &&
      scope.requestScopeKey === requestScopeKey
      ? entry
      : null;
  }

  public async read(
    uid: string,
    displayMonth: string,
  ): Promise<FinancialPeriodSnapshotCacheEntry | null> {
    const key = this.getKey(uid, displayMonth);
    const memoryEntry = this.memory.get(key);
    if (memoryEntry && isValidEntry(memoryEntry)) {
      return memoryEntry;
    }

    try {
      const serialized = await AsyncStorage.getItem(key);
      if (!serialized) return null;
      const parsed: unknown = JSON.parse(serialized);
      if (!isValidEntry(parsed) || parsed.uid !== uid || parsed.displayMonth !== displayMonth) {
        return null;
      }
      this.memory.set(key, parsed);
      this.periodMemoryScopes.delete(key);
      return parsed;
    } catch {
      return null;
    }
  }

  public getAllTimeMemory(
    uid: string,
    sessionVersion: number,
  ): FinancialAllTimeSnapshotCacheEntry | null {
    const entry = this.memory.get(this.getAllTimeKey(uid, sessionVersion));
    return entry && isValidAllTimeEntry(entry) ? entry : null;
  }

  public async readAllTime(
    uid: string,
    sessionVersion: number,
  ): Promise<FinancialAllTimeSnapshotCacheEntry | null> {
    const key = this.getAllTimeKey(uid, sessionVersion);
    const memoryEntry = this.memory.get(key);
    if (memoryEntry && isValidAllTimeEntry(memoryEntry)) {
      return memoryEntry;
    }

    try {
      const serialized = await AsyncStorage.getItem(key);
      if (!serialized) return null;
      const parsed: unknown = JSON.parse(serialized);
      if (
        !isValidAllTimeEntry(parsed) ||
        parsed.uid !== uid ||
        parsed.sessionVersion !== sessionVersion
      ) {
        return null;
      }
      this.memory.set(key, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  public async write(
    uid: string,
    displayMonth: string,
    snapshot: UserDataSnapshot,
    comparisonSnapshot: UserDataSnapshot,
    sessionVersion?: number,
    requestScopeKey?: string,
  ): Promise<void> {
    const entry: FinancialPeriodSnapshotCacheEntry = {
      cacheVersion: CACHE_VERSION,
      uid,
      displayMonth,
      snapshot,
      comparisonSnapshot,
      cachedAt: Date.now(),
    };
    const key = this.getKey(uid, displayMonth);
    this.memory.set(key, entry);
    if (sessionVersion !== undefined && requestScopeKey !== undefined) {
      this.periodMemoryScopes.set(key, { sessionVersion, requestScopeKey });
    } else {
      this.periodMemoryScopes.delete(key);
    }
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  }

  public async invalidate(uid: string, displayMonth: string): Promise<void> {
    const key = this.getKey(uid, displayMonth);
    this.periodInvalidationVersions.set(
      key,
      this.getPeriodInvalidationVersion(uid, displayMonth) + 1,
    );
    this.memory.delete(key);
    this.periodMemoryScopes.delete(key);
    this.periodInvalidationListeners.get(uid)?.forEach((listener) => listener(displayMonth));
    await AsyncStorage.removeItem(key);
  }

  public async writeAllTime(
    uid: string,
    sessionVersion: number,
    snapshot: UserDataSnapshot,
  ): Promise<void> {
    const entry: FinancialAllTimeSnapshotCacheEntry = {
      cacheVersion: CACHE_VERSION,
      coverage: 'all',
      uid,
      sessionVersion,
      snapshot,
      remoteComplete: true,
      routesCoverage: 'local-only',
      cachedAt: Date.now(),
    };
    const key = this.getAllTimeKey(uid, sessionVersion);
    this.memory.set(key, entry);
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  }

  public async invalidateAllTime(uid: string, sessionVersion: number): Promise<void> {
    const key = this.getAllTimeKey(uid, sessionVersion);
    this.memory.delete(key);
    await AsyncStorage.removeItem(key);
  }
}

export const financialPeriodSnapshotCache = new FinancialPeriodSnapshotCache();
