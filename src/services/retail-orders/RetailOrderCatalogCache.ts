import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RetailOrderRecord } from './RetailOrderDataSource';

const CACHE_VERSION = 1;
const CACHE_PREFIX = '@pareact/retail-order-catalog-cache-v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidRecord(value: unknown): value is RetailOrderRecord {
  return isRecord(value) && typeof value.id === 'string';
}

export class RetailOrderCatalogCache {
  public getKey(uid: string): string {
    return `${CACHE_PREFIX}:${uid}`;
  }

  public async read(uid: string): Promise<RetailOrderRecord[] | null> {
    try {
      const serialized = await AsyncStorage.getItem(this.getKey(uid));
      if (!serialized) return null;
      const parsed: unknown = JSON.parse(serialized);
      if (
        !isRecord(parsed) ||
        parsed.cacheVersion !== CACHE_VERSION ||
        !Array.isArray(parsed.records) ||
        !parsed.records.every(isValidRecord)
      ) {
        return null;
      }
      return parsed.records;
    } catch {
      return null;
    }
  }

  public async write(uid: string, records: readonly RetailOrderRecord[]): Promise<void> {
    await AsyncStorage.setItem(
      this.getKey(uid),
      JSON.stringify({ cacheVersion: CACHE_VERSION, records }),
    );
  }
}

export const retailOrderCatalogCache = new RetailOrderCatalogCache();
