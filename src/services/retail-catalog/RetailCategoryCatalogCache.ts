import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RetailCategoryRecord } from './RetailCategoryDataSource';

const CACHE_VERSION = 1;
const CACHE_PREFIX = '@pareact/retail-category-catalog-cache-v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidRetailCategory(value: unknown): value is RetailCategoryRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    typeof value.normalizedLabel === 'string' &&
    typeof value.active === 'boolean'
  );
}

function isValidCache(value: unknown): value is {
  cacheVersion: number;
  records: RetailCategoryRecord[];
} {
  return (
    isRecord(value) &&
    value.cacheVersion === CACHE_VERSION &&
    Array.isArray(value.records) &&
    value.records.every(isValidRetailCategory)
  );
}

export class RetailCategoryCatalogCache {
  public getKey(uid: string): string {
    return `${CACHE_PREFIX}:${uid}`;
  }

  public async read(uid: string): Promise<RetailCategoryRecord[] | null> {
    try {
      const serialized = await AsyncStorage.getItem(this.getKey(uid));
      if (!serialized) return null;
      const parsed: unknown = JSON.parse(serialized);
      return isValidCache(parsed) ? parsed.records : null;
    } catch {
      return null;
    }
  }

  public async write(uid: string, records: readonly RetailCategoryRecord[]): Promise<void> {
    await AsyncStorage.setItem(
      this.getKey(uid),
      JSON.stringify({ cacheVersion: CACHE_VERSION, records }),
    );
  }
}

export const retailCategoryCatalogCache = new RetailCategoryCatalogCache();
