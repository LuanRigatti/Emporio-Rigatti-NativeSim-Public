import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RetailCostEntryRecord } from './RetailCostEntryDataSource';

const CACHE_VERSION = 1;
const CACHE_PREFIX = '@pareact/retail-cost-entry-cache-v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidRecord(value: unknown): value is RetailCostEntryRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.effectiveDate === 'string' &&
    typeof value.purchasedQuantity === 'number' &&
    typeof value.purchaseTotalCost === 'number' &&
    typeof value.normalizedUnitCost === 'number' &&
    typeof value.unit === 'string'
  );
}

export class RetailCostEntryCatalogCache {
  public getKey(uid: string, costItemId: string): string {
    return `${CACHE_PREFIX}:${uid}:${costItemId}`;
  }

  public async read(uid: string, costItemId: string): Promise<RetailCostEntryRecord[] | null> {
    try {
      const serialized = await AsyncStorage.getItem(this.getKey(uid, costItemId));
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

  public async write(
    uid: string,
    costItemId: string,
    records: readonly RetailCostEntryRecord[],
  ): Promise<void> {
    await AsyncStorage.setItem(
      this.getKey(uid, costItemId),
      JSON.stringify({ cacheVersion: CACHE_VERSION, records }),
    );
  }
}

export const retailCostEntryCatalogCache = new RetailCostEntryCatalogCache();
