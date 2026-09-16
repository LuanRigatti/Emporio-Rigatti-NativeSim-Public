import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RetailClientRecord } from './RetailClientDataSource';

const CACHE_VERSION = 1;
const CACHE_PREFIX = '@pareact/retail-client-catalog-cache-v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidRetailClient(value: unknown): value is RetailClientRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.normalizedName === 'string' &&
    typeof value.active === 'boolean'
  );
}

function isValidCache(value: unknown): value is {
  cacheVersion: number;
  records: RetailClientRecord[];
} {
  return (
    isRecord(value) &&
    value.cacheVersion === CACHE_VERSION &&
    Array.isArray(value.records) &&
    value.records.every(isValidRetailClient)
  );
}

export class RetailClientCatalogCache {
  public getKey(uid: string): string {
    return `${CACHE_PREFIX}:${uid}`;
  }

  public async read(uid: string): Promise<RetailClientRecord[] | null> {
    try {
      const serialized = await AsyncStorage.getItem(this.getKey(uid));
      if (!serialized) return null;
      const parsed: unknown = JSON.parse(serialized);
      return isValidCache(parsed) ? parsed.records : null;
    } catch {
      return null;
    }
  }

  public async write(uid: string, records: readonly RetailClientRecord[]): Promise<void> {
    await AsyncStorage.setItem(
      this.getKey(uid),
      JSON.stringify({ cacheVersion: CACHE_VERSION, records }),
    );
  }
}

export const retailClientCatalogCache = new RetailClientCatalogCache();
