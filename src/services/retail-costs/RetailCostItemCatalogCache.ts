import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RetailCostItemRecord } from './RetailCostItemDataSource';

const CACHE_VERSION = 1;
const CACHE_PREFIX = '@pareact/retail-cost-item-catalog-cache-v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidRecord(value: unknown): value is RetailCostItemRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.normalizedName === 'string' &&
    typeof value.unit === 'string' &&
    typeof value.active === 'boolean'
  );
}

export class RetailCostItemCatalogCache {
  public getKey(uid: string): string {
    return `${CACHE_PREFIX}:${uid}`;
  }

  public async read(uid: string): Promise<RetailCostItemRecord[] | null> {
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

  public async write(uid: string, records: readonly RetailCostItemRecord[]): Promise<void> {
    await AsyncStorage.setItem(
      this.getKey(uid),
      JSON.stringify({ cacheVersion: CACHE_VERSION, records }),
    );
  }
}

export const retailCostItemCatalogCache = new RetailCostItemCatalogCache();
