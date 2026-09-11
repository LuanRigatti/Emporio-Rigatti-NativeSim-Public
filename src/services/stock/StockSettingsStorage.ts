import AsyncStorage from '@react-native-async-storage/async-storage';

export const STOCK_SETTINGS_STORAGE_KEY = '@pareact/stock-settings-v1';

export type StockPeriodSettings = {
  initialBuckets: string;
  purchasedBuckets: string;
};

export type StockSettings = {
  periods: Record<string, StockPeriodSettings>;
};

export const EMPTY_STOCK_PERIOD_SETTINGS: StockPeriodSettings = {
  initialBuckets: '',
  purchasedBuckets: '',
};

export const EMPTY_STOCK_SETTINGS: StockSettings = {
  periods: {},
};

export function createStockPeriodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function getCurrentStockPeriodKey(): string {
  const today = new Date();
  return createStockPeriodKey(today.getFullYear(), today.getMonth() + 1);
}

function parsePeriodSettings(value: unknown): StockPeriodSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...EMPTY_STOCK_PERIOD_SETTINGS };
  }

  const record = value as Record<string, unknown>;
  return {
    initialBuckets: typeof record.initialBuckets === 'string' ? record.initialBuckets : '',
    purchasedBuckets: typeof record.purchasedBuckets === 'string' ? record.purchasedBuckets : '',
  };
}

function parseSettings(serialized: string | null): StockSettings | null {
  if (!serialized) return null;

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const record = parsed as Record<string, unknown>;
    if (record.periods && typeof record.periods === 'object' && !Array.isArray(record.periods)) {
      const periods = Object.entries(record.periods).reduce<Record<string, StockPeriodSettings>>(
        (result, [periodKey, periodSettings]) => {
          result[periodKey] = parsePeriodSettings(periodSettings);
          return result;
        },
        {},
      );

      return { periods };
    }

    // Migrate the previous global values into the current month without losing them.
    if (typeof record.initialBuckets === 'string' || typeof record.purchasedBuckets === 'string') {
      return {
        periods: {
          [getCurrentStockPeriodKey()]: {
            initialBuckets: typeof record.initialBuckets === 'string' ? record.initialBuckets : '',
            purchasedBuckets:
              typeof record.purchasedBuckets === 'string' ? record.purchasedBuckets : '',
          },
        },
      };
    }

    return null;
  } catch {
    return null;
  }
}

export class StockSettingsStorage {
  private writeQueue = Promise.resolve();

  public async load(): Promise<StockSettings> {
    try {
      return (
        parseSettings(await AsyncStorage.getItem(STOCK_SETTINGS_STORAGE_KEY)) ?? {
          periods: {},
        }
      );
    } catch (error) {
      if (__DEV__) console.warn('[StockSettingsStorage] Falha ao ler estoque.', error);
      return { periods: {} };
    }
  }

  public save(settings: StockSettings): Promise<void> {
    this.writeQueue = this.writeQueue
      .then(() => AsyncStorage.setItem(STOCK_SETTINGS_STORAGE_KEY, JSON.stringify(settings)))
      .catch((error) => {
        if (__DEV__) console.warn('[StockSettingsStorage] Falha ao salvar estoque.', error);
      });
    return this.writeQueue;
  }
}

export const stockSettingsStorage = new StockSettingsStorage();
