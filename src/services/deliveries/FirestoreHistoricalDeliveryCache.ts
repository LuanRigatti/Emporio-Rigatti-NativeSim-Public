import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Delivery } from '@/types/data';

const CACHE_VERSION = 1;
const CACHE_PREFIX = '@pareact/historical-deliveries-cache-v1:';

type CachedHistoricalDeliveries = {
  cacheVersion: number;
  savedAt: number;
  deliveries: Delivery[];
};

export type FirestoreHistoricalDeliveryCacheEntry = {
  savedAt: number;
  deliveries: Delivery[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidDelivery(value: unknown): value is Delivery {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.data === 'string' &&
    typeof value.valor === 'number' &&
    typeof value.quantidade === 'number'
  );
}

function isValidCache(value: unknown): value is CachedHistoricalDeliveries {
  return (
    isRecord(value) &&
    value.cacheVersion === CACHE_VERSION &&
    Array.isArray(value.deliveries) &&
    value.deliveries.every(isValidDelivery)
  );
}

export class FirestoreHistoricalDeliveryCache {
  private readonly memoryCache = new Map<string, FirestoreHistoricalDeliveryCacheEntry>();

  public getKey(uid: string): string {
    return `${CACHE_PREFIX}${uid}`;
  }

  public getMemoryEntry(uid: string): FirestoreHistoricalDeliveryCacheEntry | null {
    const entry = this.memoryCache.get(uid);
    return entry ?? null;
  }

  public getMemory(uid: string): Delivery[] | null {
    return this.getMemoryEntry(uid)?.deliveries ?? null;
  }

  public async readEntry(uid: string): Promise<FirestoreHistoricalDeliveryCacheEntry | null> {
    const memory = this.getMemoryEntry(uid);
    if (memory) return memory;

    try {
      const serialized = await AsyncStorage.getItem(this.getKey(uid));
      if (!serialized) return null;
      const parsed: unknown = JSON.parse(serialized);
      if (!isValidCache(parsed)) return null;

      this.memoryCache.set(uid, {
        savedAt: Number.isFinite(parsed.savedAt) ? parsed.savedAt : 0,
        deliveries: parsed.deliveries,
      });
      return this.getMemoryEntry(uid);
    } catch {
      return null;
    }
  }

  public async read(uid: string): Promise<Delivery[] | null> {
    return (await this.readEntry(uid))?.deliveries ?? null;
  }

  public async write(uid: string, deliveries: readonly Delivery[]): Promise<void> {
    const copy = [...deliveries];
    const savedAt = Date.now();
    this.memoryCache.set(uid, { savedAt, deliveries: copy });
    await AsyncStorage.setItem(
      this.getKey(uid),
      JSON.stringify({ cacheVersion: CACHE_VERSION, savedAt, deliveries: copy }),
    );
  }

  public async invalidate(uid: string): Promise<void> {
    this.memoryCache.delete(uid);
    try {
      await AsyncStorage.removeItem(this.getKey(uid));
    } catch {
      // Falhas silenciosas de remoção em AsyncStorage não devem quebrar o fluxo
    }
  }

  public clearMemory(): void {
    this.memoryCache.clear();
  }
}

export const firestoreHistoricalDeliveryCache = new FirestoreHistoricalDeliveryCache();
