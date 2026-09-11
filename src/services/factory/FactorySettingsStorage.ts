import AsyncStorage from '@react-native-async-storage/async-storage';

export const FACTORY_SETTINGS_STORAGE_KEY = '@pareact/factory-settings-v1';

export type FactorySettings = {
  bucketCost: string;
};

export const EMPTY_FACTORY_SETTINGS: FactorySettings = {
  bucketCost: '',
};

function parseSettings(serialized: string | null): FactorySettings | null {
  if (!serialized) return null;

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const value = (parsed as { bucketCost?: unknown }).bucketCost;
    return { bucketCost: typeof value === 'string' ? value : '' };
  } catch {
    return null;
  }
}

export class FactorySettingsStorage {
  private writeQueue = Promise.resolve();

  public async load(): Promise<FactorySettings> {
    try {
      return (
        parseSettings(await AsyncStorage.getItem(FACTORY_SETTINGS_STORAGE_KEY)) ?? {
          ...EMPTY_FACTORY_SETTINGS,
        }
      );
    } catch (error) {
      if (__DEV__) console.warn('[FactorySettingsStorage] Falha ao ler configurações.', error);
      return { ...EMPTY_FACTORY_SETTINGS };
    }
  }

  public save(settings: FactorySettings): Promise<void> {
    this.writeQueue = this.writeQueue
      .then(() => AsyncStorage.setItem(FACTORY_SETTINGS_STORAGE_KEY, JSON.stringify(settings)))
      .catch((error) => {
        if (__DEV__) console.warn('[FactorySettingsStorage] Falha ao salvar configurações.', error);
      });
    return this.writeQueue;
  }
}

export const factorySettingsStorage = new FactorySettingsStorage();
