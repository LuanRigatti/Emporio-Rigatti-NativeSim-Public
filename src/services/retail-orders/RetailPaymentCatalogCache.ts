import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RetailPaymentRecord } from './RetailPaymentDataSource';

const CACHE_VERSION = 1;
const CACHE_PREFIX = '@pareact/retail-payment-cache-v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidRecord(value: unknown): value is RetailPaymentRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.amount === 'number' &&
    typeof value.paidAt === 'string' &&
    typeof value.method === 'string' &&
    typeof value.status === 'string'
  );
}

export class RetailPaymentCatalogCache {
  public getKey(uid: string, orderId: string): string {
    return `${CACHE_PREFIX}:${uid}:${orderId}`;
  }

  public async read(uid: string, orderId: string): Promise<RetailPaymentRecord[] | null> {
    try {
      const serialized = await AsyncStorage.getItem(this.getKey(uid, orderId));
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
    orderId: string,
    records: readonly RetailPaymentRecord[],
  ): Promise<void> {
    await AsyncStorage.setItem(
      this.getKey(uid, orderId),
      JSON.stringify({ cacheVersion: CACHE_VERSION, records }),
    );
  }
}

export const retailPaymentCatalogCache = new RetailPaymentCatalogCache();
