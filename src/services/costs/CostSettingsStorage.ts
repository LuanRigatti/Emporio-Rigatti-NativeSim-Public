import AsyncStorage from '@react-native-async-storage/async-storage';

export const COST_SETTINGS_STORAGE_KEY = '@pareact/cost-settings-v1';
export const COST_SETTINGS_DEFAULT_SCOPE = 'anonymous';

export type CostPeriod = 'day' | 'month' | 'year';
export type CostField =
  'light' | 'estar' | 'kilometers' | 'fuel' | 'fuelPrice' | 'fuelType' | 'other';

export type CostValues = Record<CostField, string>;
export type CostSettings = {
  periods: Record<CostPeriod, Record<string, CostValues>>;
};

export type CostSettingsOperationOptions = {
  canRun?: () => boolean;
  sessionKey?: string;
};

export class StaleCostSettingsOperationError extends Error {
  public constructor() {
    super('A operação de custos pertence a uma sessão encerrada.');
    this.name = 'StaleCostSettingsOperationError';
  }
}

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

export function costSettingsStorageKey(scope = COST_SETTINGS_DEFAULT_SCOPE): string {
  if (scope === COST_SETTINGS_DEFAULT_SCOPE) return COST_SETTINGS_STORAGE_KEY;
  return `${COST_SETTINGS_STORAGE_KEY}:${encodeURIComponent(scope)}`;
}

function cloneSettings(settings: CostSettings): CostSettings {
  return {
    periods: {
      day: clonePeriod(settings.periods.day),
      month: clonePeriod(settings.periods.month),
      year: clonePeriod(settings.periods.year),
    },
  };
}

function clonePeriod(period: Record<string, CostValues>): Record<string, CostValues> {
  return Object.fromEntries(Object.entries(period).map(([key, values]) => [key, { ...values }]));
}

export class CostSettingsStorage {
  private readonly writeQueues = new Map<string, Promise<void>>();
  private readonly loadPromises = new Map<string, Promise<CostSettings>>();
  private readonly cachedSettings = new Map<string, CostSettings>();

  public getCached(scope = COST_SETTINGS_DEFAULT_SCOPE): CostSettings | null {
    const settings = this.cachedSettings.get(scope);
    return settings ? cloneSettings(settings) : null;
  }

  public load(
    scope = COST_SETTINGS_DEFAULT_SCOPE,
    options?: CostSettingsOperationOptions,
  ): Promise<CostSettings> {
    const loadKey = createLoadKey(scope, options?.sessionKey);
    assertOperationCanRun(options);
    const pendingWrite = this.writeQueues.get(scope);
    if (pendingWrite) {
      return pendingWrite.then(() => this.load(scope, options));
    }

    const cached = this.cachedSettings.get(scope);
    if (cached) return Promise.resolve(cloneSettings(cached));

    const pending = this.loadPromises.get(loadKey);
    if (pending)
      return pending.then((settings) => {
        assertOperationCanRun(options);
        return cloneSettings(settings);
      });

    const load = (async () => {
      const pendingWrite = this.writeQueues.get(scope);
      if (pendingWrite) await pendingWrite;
      assertOperationCanRun(options);

      try {
        const serialized = await AsyncStorage.getItem(costSettingsStorageKey(scope));
        assertOperationCanRun(options);
        const settings = parseSettings(serialized) ?? createEmptySettings();
        this.cachedSettings.set(scope, settings);
        return settings;
      } catch (error) {
        if (error instanceof StaleCostSettingsOperationError) throw error;
        if (__DEV__) console.warn('[CostSettingsStorage] Falha ao ler custos.', error);
        return createEmptySettings();
      }
    })();

    this.loadPromises.set(loadKey, load);
    void load.then(
      () => {
        if (this.loadPromises.get(loadKey) === load) this.loadPromises.delete(loadKey);
      },
      () => {
        if (this.loadPromises.get(loadKey) === load) this.loadPromises.delete(loadKey);
      },
    );
    return load.then(cloneSettings);
  }

  public save(
    settings: CostSettings,
    scope = COST_SETTINGS_DEFAULT_SCOPE,
    options?: CostSettingsOperationOptions,
  ): Promise<void> {
    const snapshot = cloneSettings(settings);
    const previous = this.writeQueues.get(scope) ?? Promise.resolve();
    const write = previous
      .catch(() => undefined)
      .then(async () => {
        assertOperationCanRun(options);
        await AsyncStorage.setItem(costSettingsStorageKey(scope), JSON.stringify(snapshot));
        assertOperationCanRun(options);
        this.cachedSettings.set(scope, snapshot);
      });
    const recovered = write.catch((error) => {
      if (error instanceof StaleCostSettingsOperationError) return;
      if (__DEV__) console.warn('[CostSettingsStorage] Falha ao salvar custos.', error);
    });
    this.writeQueues.set(scope, recovered);
    void recovered.finally(() => {
      if (this.writeQueues.get(scope) === recovered) this.writeQueues.delete(scope);
    });
    return write;
  }
}

function createEmptySettings(): CostSettings {
  return {
    periods: { day: {}, month: {}, year: {} },
  };
}

function createLoadKey(scope: string, sessionKey?: string): string {
  return `${scope}\u0000${sessionKey ?? 'shared'}`;
}

function assertOperationCanRun(options?: CostSettingsOperationOptions): void {
  if (options?.canRun && !options.canRun()) throw new StaleCostSettingsOperationError();
}

export const costSettingsStorage = new CostSettingsStorage();
