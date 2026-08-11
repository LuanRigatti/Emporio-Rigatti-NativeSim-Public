import AsyncStorage from '@react-native-async-storage/async-storage';

import type { StockPeriodSummary } from './StockCalculationService';

const CACHE_VERSION = 1;
const CACHE_PREFIX = '@pareact/stock-period-cache-v1';

export type StockPeriodSnapshotCacheEntry = {
  cacheVersion: number;
  uid: string;
  period: string;
  summary: StockPeriodSummary;
  bucketCost: number;
  stockValue: number;
  cachedAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSummary(value: unknown): value is StockPeriodSummary {
  if (!isRecord(value)) return false;
  return ['deliveredBuckets', 'endingBuckets', 'openingBuckets', 'purchasedBuckets'].every(
    (field) => typeof value[field] === 'number' && Number.isFinite(value[field]),
  );
}

function isValidEntry(value: unknown): value is StockPeriodSnapshotCacheEntry {
  if (!isRecord(value)) return false;
  return (
    value.cacheVersion === CACHE_VERSION &&
    typeof value.uid === 'string' &&
    typeof value.period === 'string' &&
    /^\d{4}-\d{2}$/.test(value.period) &&
    isSummary(value.summary) &&
    typeof value.bucketCost === 'number' &&
    Number.isFinite(value.bucketCost) &&
    typeof value.stockValue === 'number' &&
    Number.isFinite(value.stockValue) &&
    typeof value.cachedAt === 'number'
  );
}

export class StockPeriodSnapshotCache {
  private readonly memory = new Map<string, StockPeriodSnapshotCacheEntry>();

  public getKey(uid: string, period: string): string {
    return `${CACHE_PREFIX}:${uid}:${period}`;
  }

  public getMemory(uid: string, period: string): StockPeriodSnapshotCacheEntry | null {
    return this.memory.get(this.getKey(uid, period)) ?? null;
  }

  public async read(uid: string, period: string): Promise<StockPeriodSnapshotCacheEntry | null> {
    const key = this.getKey(uid, period);
    const memoryEntry = this.memory.get(key);
    if (memoryEntry) return memoryEntry;

    try {
      const serialized = await AsyncStorage.getItem(key);
      if (!serialized) return null;
      const parsed: unknown = JSON.parse(serialized);
      if (!isValidEntry(parsed) || parsed.uid !== uid || parsed.period !== period) return null;
      this.memory.set(key, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  public async write(
    uid: string,
    period: string,
    summary: StockPeriodSummary,
    bucketCost: number,
    stockValue: number,
  ): Promise<void> {
    const entry: StockPeriodSnapshotCacheEntry = {
      cacheVersion: CACHE_VERSION,
      uid,
      period,
      summary,
      bucketCost,
      stockValue,
      cachedAt: Date.now(),
    };
    const key = this.getKey(uid, period);
    this.memory.set(key, entry);
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  }
}

export const stockPeriodSnapshotCache = new StockPeriodSnapshotCache();
