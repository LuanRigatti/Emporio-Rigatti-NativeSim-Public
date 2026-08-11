import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UserDataSnapshot } from '@/services/data';

const CACHE_VERSION = 1;
const CACHE_PREFIX = '@pareact/financial-period-cache-v1';

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

export class FinancialPeriodSnapshotCache {
  private readonly memory = new Map<string, FinancialPeriodSnapshotCacheEntry>();

  public getKey(uid: string, displayMonth: string): string {
    return `${CACHE_PREFIX}:${uid}:${displayMonth}`;
  }

  public getMemory(uid: string, displayMonth: string): FinancialPeriodSnapshotCacheEntry | null {
    return this.memory.get(this.getKey(uid, displayMonth)) ?? null;
  }

  public async read(
    uid: string,
    displayMonth: string,
  ): Promise<FinancialPeriodSnapshotCacheEntry | null> {
    const key = this.getKey(uid, displayMonth);
    const memoryEntry = this.memory.get(key);
    if (memoryEntry) return memoryEntry;

    try {
      const serialized = await AsyncStorage.getItem(key);
      if (!serialized) return null;
      const parsed: unknown = JSON.parse(serialized);
      if (!isValidEntry(parsed) || parsed.uid !== uid || parsed.displayMonth !== displayMonth) {
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
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  }

  public async invalidate(uid: string, displayMonth: string): Promise<void> {
    const key = this.getKey(uid, displayMonth);
    this.memory.delete(key);
    await AsyncStorage.removeItem(key);
  }
}

export const financialPeriodSnapshotCache = new FinancialPeriodSnapshotCache();
