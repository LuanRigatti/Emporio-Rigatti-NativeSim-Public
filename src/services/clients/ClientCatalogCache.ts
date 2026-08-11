import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ClientRecord } from './FirestoreClientDataSource';

const CACHE_VERSION = 1;
const CACHE_PREFIX = '@pareact/client-catalog-cache-v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidClient(value: unknown): value is ClientRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.normalizedName === 'string'
  );
}

function isValidCache(value: unknown): value is { cacheVersion: number; records: ClientRecord[] } {
  return (
    isRecord(value) &&
    value.cacheVersion === CACHE_VERSION &&
    Array.isArray(value.records) &&
    value.records.every(isValidClient)
  );
}

export class ClientCatalogCache {
  public getKey(uid: string): string {
    return `${CACHE_PREFIX}:${uid}`;
  }

  public async read(uid: string): Promise<ClientRecord[] | null> {
    try {
      const serialized = await AsyncStorage.getItem(this.getKey(uid));
      if (!serialized) return null;
      const parsed: unknown = JSON.parse(serialized);
      return isValidCache(parsed) ? parsed.records : null;
    } catch {
      return null;
    }
  }

  public async write(uid: string, records: readonly ClientRecord[]): Promise<void> {
    await AsyncStorage.setItem(
      this.getKey(uid),
      JSON.stringify({ cacheVersion: CACHE_VERSION, records }),
    );
  }
}

export const clientCatalogCache = new ClientCatalogCache();
