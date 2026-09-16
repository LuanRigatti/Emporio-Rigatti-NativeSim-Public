import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RetailCompositionVersionRecord } from './RetailCompositionDataSource';

const CACHE_VERSION = 1;
const CACHE_PREFIX = '@pareact/retail-composition-version-cache-v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidRecord(value: unknown): value is RetailCompositionVersionRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.productId === 'string' &&
    typeof value.effectiveFrom === 'string' &&
    typeof value.active === 'boolean' &&
    Array.isArray(value.components)
  );
}

export class RetailCompositionCatalogCache {
  public getKey(uid: string, productId: string): string {
    return `${CACHE_PREFIX}:${uid}:${productId}`;
  }

  public async read(
    uid: string,
    productId: string,
  ): Promise<RetailCompositionVersionRecord[] | null> {
    try {
      const serialized = await AsyncStorage.getItem(this.getKey(uid, productId));
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
    productId: string,
    records: readonly RetailCompositionVersionRecord[],
  ): Promise<void> {
    await AsyncStorage.setItem(
      this.getKey(uid, productId),
      JSON.stringify({ cacheVersion: CACHE_VERSION, records }),
    );
  }
}

export const retailCompositionCatalogCache = new RetailCompositionCatalogCache();
