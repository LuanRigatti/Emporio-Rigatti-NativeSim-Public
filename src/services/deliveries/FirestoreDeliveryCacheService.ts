import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Delivery } from '@/types/data';

const CACHE_VERSION = 1;
const CACHE_PREFIX = 'firestore-deliveries-cache-v1:';

type CachedDeliveries = {
  date: string;
  deliveries: Delivery[];
  savedAt: number;
  version: number;
};

function cacheKey(uid: string, date: string): string {
  return `${CACHE_PREFIX}${uid}:${date}`;
}

export class FirestoreDeliveryCacheService {
  public async read(uid: string, date: string): Promise<Delivery[] | null> {
    const serialized = await AsyncStorage.getItem(cacheKey(uid, date));
    if (!serialized) return null;

    try {
      const cached = JSON.parse(serialized) as CachedDeliveries;
      if (
        cached.version !== CACHE_VERSION ||
        cached.date !== date ||
        !Array.isArray(cached.deliveries)
      ) {
        return null;
      }
      return cached.deliveries;
    } catch {
      return null;
    }
  }

  public async write(uid: string, date: string, deliveries: readonly Delivery[]): Promise<void> {
    const value: CachedDeliveries = {
      date,
      deliveries: [...deliveries],
      savedAt: Date.now(),
      version: CACHE_VERSION,
    };
    await AsyncStorage.setItem(cacheKey(uid, date), JSON.stringify(value));
  }
}

export const firestoreDeliveryCacheService = new FirestoreDeliveryCacheService();
