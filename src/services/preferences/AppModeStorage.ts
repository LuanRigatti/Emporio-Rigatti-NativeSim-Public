import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_APP_MODE, isAppMode, type AppMode } from '@/types/appMode';

export const APP_MODE_STORAGE_PREFIX = '@pareact/app-mode-v1:';

export interface AppModeStorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

export function appModeStorageKey(uid: string): string {
  const normalizedUid = uid.trim();
  if (!normalizedUid) throw new Error('AppMode requer um UID válido.');
  return `${APP_MODE_STORAGE_PREFIX}${encodeURIComponent(normalizedUid)}`;
}

export class AppModeStorage {
  private readonly cachedValues = new Map<string, AppMode>();
  private readonly loadPromises = new Map<string, Promise<AppMode>>();

  public constructor(private readonly storage: AppModeStorageAdapter = AsyncStorage) {}

  public getCached(uid: string): AppMode | undefined {
    const normalizedUid = uid.trim();
    if (!normalizedUid) return undefined;
    return this.cachedValues.get(normalizedUid);
  }

  public async load(uid: string): Promise<AppMode> {
    const normalizedUid = uid.trim();
    const key = appModeStorageKey(normalizedUid);
    const cachedValue = this.cachedValues.get(normalizedUid);
    if (cachedValue) return cachedValue;

    const pendingLoad = this.loadPromises.get(normalizedUid);
    if (pendingLoad) return pendingLoad;

    const loadPromise = this.storage
      .getItem(key)
      .then((value) => (isAppMode(value) ? value : DEFAULT_APP_MODE))
      .catch(() => DEFAULT_APP_MODE)
      .then((mode) => {
        this.cachedValues.set(normalizedUid, mode);
        return mode;
      })
      .finally(() => {
        this.loadPromises.delete(normalizedUid);
      });

    this.loadPromises.set(normalizedUid, loadPromise);
    return loadPromise;
  }

  public async save(uid: string, mode: AppMode): Promise<void> {
    const normalizedUid = uid.trim();
    const key = appModeStorageKey(normalizedUid);
    await this.storage.setItem(key, mode);
    this.cachedValues.set(normalizedUid, mode);
  }
}

export const appModeStorage = new AppModeStorage();
