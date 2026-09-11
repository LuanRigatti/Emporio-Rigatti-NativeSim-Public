import AsyncStorage from '@react-native-async-storage/async-storage';

export const COST_SETTINGS_STORAGE_KEY = '@pareact/cost-settings-v1';

export type CostPeriod = 'day' | 'month' | 'year';
export type CostField =
  'light' | 'estar' | 'kilometers' | 'fuel' | 'fuelPrice' | 'fuelType' | 'other';

export type CostValues = Record<CostField, string>;
export type CostSettings = {
  periods: Record<CostPeriod, Record<string, CostValues>>;
};

export const EMPTY_COST_VALUES: CostValues = {
  estar: '',
  fuel: '',
  fuelPrice: '',
  fuelType: '',
  kilometers: '',
  light: '',
  other: '',
};

export const EMPTY_COST_SETTINGS: CostSettings = {
  periods: { day: {}, month: {}, year: {} },
};

function parseValues(value: unknown): CostValues {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...EMPTY_COST_VALUES };
  }

  const record = value as Partial<Record<CostField, unknown>>;
  return {
    estar: typeof record.estar === 'string' ? record.estar : '',
    fuel: typeof record.fuel === 'string' ? record.fuel : '',
    fuelPrice: typeof record.fuelPrice === 'string' ? record.fuelPrice : '',
    fuelType: typeof record.fuelType === 'string' ? record.fuelType : '',
    kilometers: typeof record.kilometers === 'string' ? record.kilometers : '',
    light: typeof record.light === 'string' ? record.light : '',
    other: typeof record.other === 'string' ? record.other : '',
  };
}

function parsePeriod(value: unknown): Record<string, CostValues> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).map(([key, periodValues]) => [key, parseValues(periodValues)]),
  );
}

function parseSettings(serialized: string | null): CostSettings | null {
  if (!serialized) return null;

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const periods = (parsed as { periods?: unknown }).periods;
    if (!periods || typeof periods !== 'object' || Array.isArray(periods)) return null;

    const record = periods as Record<string, unknown>;
    return {
      periods: {
        day: parsePeriod(record.day),
        month: parsePeriod(record.month),
        year: parsePeriod(record.year),
      },
    };
  } catch {
    return null;
  }
}

export class CostSettingsStorage {
  private writeQueue = Promise.resolve();
  private cachedSettings: CostSettings | null = null;

  public getCached(): CostSettings | null {
    return this.cachedSettings;
  }

  public async load(): Promise<CostSettings> {
    if (this.cachedSettings) return this.cachedSettings;

    try {
      const settings = parseSettings(await AsyncStorage.getItem(COST_SETTINGS_STORAGE_KEY)) ?? {
        periods: { day: {}, month: {}, year: {} },
      };
      this.cachedSettings = settings;
      return settings;
    } catch (error) {
      if (__DEV__) console.warn('[CostSettingsStorage] Falha ao ler custos.', error);
      const settings = { periods: { day: {}, month: {}, year: {} } };
      this.cachedSettings = settings;
      return settings;
    }
  }

  public save(settings: CostSettings): Promise<void> {
    this.cachedSettings = settings;
    this.writeQueue = this.writeQueue
      .then(() => AsyncStorage.setItem(COST_SETTINGS_STORAGE_KEY, JSON.stringify(settings)))
      .catch((error) => {
        if (__DEV__) console.warn('[CostSettingsStorage] Falha ao salvar custos.', error);
      });
    return this.writeQueue;
  }
}

export const costSettingsStorage = new CostSettingsStorage();
