import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RetailProductRecord } from './RetailProductDataSource';

const CACHE_VERSION = 1;
const CACHE_PREFIX = '@pareact/retail-product-catalog-cache-v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidRetailProduct(value: unknown): value is RetailProductRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.categoryId === 'string' &&
    typeof value.productName === 'string' &&
    typeof value.standardSalePrice === 'number' &&
    Number.isFinite(value.standardSalePrice) &&
    typeof value.active === 'boolean'
  );
}

function isValidCache(value: unknown): value is {
  cacheVersion: number;
  records: RetailProductRecord[];
} {
  return (
    isRecord(value) &&
    value.cacheVersion === CACHE_VERSION &&
    Array.isArray(value.records) &&
    value.records.every(isValidRetailProduct)
  );
}

export class RetailProductCatalogCache {
  public getKey(uid: string): string {
    return `${CACHE_PREFIX}:${uid}`;
  }

  public async read(uid: string): Promise<RetailProductRecord[] | null> {
    try {
      const serialized = await AsyncStorage.getItem(this.getKey(uid));
      if (!serialized) return null;
      const parsed: unknown = JSON.parse(serialized);
      return isValidCache(parsed) ? parsed.records : null;
    } catch {
      return null;
    }
  }

  public async write(uid: string, records: readonly RetailProductRecord[]): Promise<void> {
    await AsyncStorage.setItem(
      this.getKey(uid),
      JSON.stringify({ cacheVersion: CACHE_VERSION, records }),
    );
  }
}

export const retailProductCatalogCache = new RetailProductCatalogCache();
