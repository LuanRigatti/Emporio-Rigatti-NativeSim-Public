import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  LiveActivityOwnership,
  LiveActivityOwnershipStore as Store,
} from './LiveActivityContracts';

const STORAGE_KEY = '@pareact/live-activity/wholesale-owner-v1';

export class AsyncStorageLiveActivityOwnershipStore implements Store {
  public async read(): Promise<LiveActivityOwnership | null> {
    const serialized = await AsyncStorage.getItem(STORAGE_KEY);
    if (!serialized) return null;

    try {
      const value = JSON.parse(serialized) as Partial<LiveActivityOwnership>;
      if (
        typeof value.uid !== 'string' ||
        typeof value.activityId !== 'string' ||
        !value.content ||
        typeof value.content.date !== 'string' ||
        typeof value.content.bucketCount !== 'number' ||
        typeof value.content.deliveryCount !== 'number' ||
        typeof value.content.isObsolete !== 'boolean'
      ) {
        return null;
      }
      return value as LiveActivityOwnership;
    } catch {
      return null;
    }
  }

  public async write(ownership: LiveActivityOwnership): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ownership));
  }

  public async clear(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}

export const liveActivityOwnershipStore = new AsyncStorageLiveActivityOwnershipStore();
