import AsyncStorage from '@react-native-async-storage/async-storage';

export const CAR_SETTINGS_STORAGE_KEY = '@pareact/car-settings-v1';

export type CarSettings = {
  gasolineAutonomy: string;
  alcoholAutonomy: string;
};

export const EMPTY_CAR_SETTINGS: CarSettings = {
  alcoholAutonomy: '5,6 Km/l',
  gasolineAutonomy: '7,4 Km/l',
};

function parseSettings(serialized: string | null): CarSettings | null {
  if (!serialized) return null;

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const value = parsed as Partial<Record<keyof CarSettings, unknown>>;
    return {
      alcoholAutonomy:
        typeof value.alcoholAutonomy === 'string'
          ? value.alcoholAutonomy
          : EMPTY_CAR_SETTINGS.alcoholAutonomy,
      gasolineAutonomy:
        typeof value.gasolineAutonomy === 'string'
          ? value.gasolineAutonomy
          : EMPTY_CAR_SETTINGS.gasolineAutonomy,
    };
  } catch {
    return null;
  }
}

export class CarSettingsStorage {
  private writeQueue = Promise.resolve();
  private cachedSettings: CarSettings | null = null;

  public getCached(): CarSettings | null {
    return this.cachedSettings ? { ...this.cachedSettings } : null;
  }

  public setCached(settings: CarSettings): void {
    this.cachedSettings = { ...settings };
  }

  public async load(): Promise<CarSettings> {
    try {
      const settings = parseSettings(await AsyncStorage.getItem(CAR_SETTINGS_STORAGE_KEY)) ?? {
        ...EMPTY_CAR_SETTINGS,
      };
      this.setCached(settings);
      return settings;
    } catch (error) {
      if (__DEV__) console.warn('[CarSettingsStorage] Falha ao ler dados do carro.', error);
      this.setCached(EMPTY_CAR_SETTINGS);
      return { ...EMPTY_CAR_SETTINGS };
    }
  }

  public save(settings: CarSettings): Promise<void> {
    const snapshot = { ...settings };
    this.writeQueue = this.writeQueue
      .then(async () => {
        await AsyncStorage.setItem(CAR_SETTINGS_STORAGE_KEY, JSON.stringify(snapshot));
        this.setCached(snapshot);
      })
      .catch((error) => {
        if (__DEV__) console.warn('[CarSettingsStorage] Falha ao salvar dados do carro.', error);
      });
    return this.writeQueue;
  }
}

export const carSettingsStorage = new CarSettingsStorage();
