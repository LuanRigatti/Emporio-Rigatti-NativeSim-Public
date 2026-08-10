import { useCallback, useEffect, useRef, useState } from 'react';

import { ENABLE_FIRESTORE_DAILY_MONTHLY } from '@/config/featureFlags';
import { useAuth } from '@/providers';
import {
  addDailyValue,
  localDailyDataDataSource,
  costSettingsStorage,
  firestoreDailyMonthlyDataSource,
  setDailyValue,
  EMPTY_COST_VALUES,
  type CostField,
  type CostPeriod,
  type CostSettings,
  type CostValues,
} from '@/services/costs';

export function useCostSettings() {
  const { user } = useAuth();
  const cachedSettings = costSettingsStorage.getCached();
  const [settings, setSettings] = useState<CostSettings>(
    () => cachedSettings ?? { periods: { day: {}, month: {}, year: {} } },
  );
  const [isHydrated, setIsHydrated] = useState(() => cachedSettings !== null);
  const [remoteReady, setRemoteReady] = useState(!ENABLE_FIRESTORE_DAILY_MONTHLY);
  const [remoteActive, setRemoteActive] = useState(false);
  const previousSettings = useRef<CostSettings | null>(null);
  const skipRemoteSync = useRef(false);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const storedSettings = await localDailyDataDataSource.load();
      if (!isMounted) return;

      previousSettings.current = storedSettings;
      setSettings((current) =>
        settingsEquivalent(current, storedSettings) ? current : storedSettings,
      );
      setIsHydrated(true);

      let nextSettings = storedSettings;
      let usingRemote = false;

      if (ENABLE_FIRESTORE_DAILY_MONTHLY && user) {
        try {
          nextSettings = await firestoreDailyMonthlyDataSource.loadAllAsCostSettings(user.id);
          usingRemote = true;
          skipRemoteSync.current = true;
        } catch (error) {
          if (__DEV__) console.warn('[useCostSettings] Firestore fallback local.', error);
        }
      }

      if (!isMounted) return;
      previousSettings.current = nextSettings;
      setSettings((current) =>
        settingsEquivalent(current, nextSettings) ? current : nextSettings,
      );
      setRemoteActive(usingRemote);
      setRemoteReady(true);
      setIsHydrated(true);
    })();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!isHydrated || !remoteReady) return;
    void localDailyDataDataSource.save(settings);
    if (remoteActive && user && previousSettings.current) {
      if (skipRemoteSync.current) {
        skipRemoteSync.current = false;
        previousSettings.current = settings;
        return;
      }
      const previous = previousSettings.current;
      previousSettings.current = settings;
      void firestoreDailyMonthlyDataSource
        .saveSettingsDiff(user.id, previous, settings)
        .catch((error) => {
          if (__DEV__) console.warn('[useCostSettings] Firestore save fallback local.', error);
          setRemoteActive(false);
        });
    } else {
      previousSettings.current = settings;
    }
  }, [isHydrated, remoteActive, remoteReady, settings, user]);

  const getValues = useCallback(
    (period: CostPeriod, key: string): CostValues =>
      settings.periods[period][key] ?? { ...EMPTY_COST_VALUES },
    [settings],
  );

  const getLatestDailyValue = useCallback(
    (field: CostField): string => {
      const entries = Object.entries(settings.periods.day).sort(([left], [right]) =>
        right.localeCompare(left),
      );

      for (const [, values] of entries) {
        const value = values[field];
        if (value.trim()) return value;
      }

      return '';
    },
    [settings],
  );

  const getMonthlySum = useCallback(
    (year: number, month: number, field: CostField) => {
      const prefix = `${year}-${String(month).padStart(2, '0')}-`;

      return Object.entries(settings.periods.day).reduce((total, [key, values]) => {
        if (!key.startsWith(prefix)) return total;
        return total + parseCostNumber(values[field]);
      }, 0);
    },
    [settings],
  );

  const updateField = useCallback(
    (period: CostPeriod, key: string, field: CostField, value: string) => {
      setSettings((current) => ({
        periods: {
          ...current.periods,
          [period]: {
            ...current.periods[period],
            [key]: {
              ...(current.periods[period][key] ?? EMPTY_COST_VALUES),
              [field]: value,
            },
          },
        },
      }));
    },
    [],
  );

  const addFieldValue = useCallback(
    (period: CostPeriod, key: string, field: CostField, value: string) => {
      setSettings((current) => ({
        periods: {
          ...current.periods,
          [period]: {
            ...current.periods[period],
            [key]: {
              ...(current.periods[period][key] ?? EMPTY_COST_VALUES),
              [field]: addDailyValue(current.periods[period][key]?.[field] ?? '', value),
            },
          },
        },
      }));
    },
    [],
  );

  const setFieldValue = useCallback(
    (period: CostPeriod, key: string, field: CostField, value: string) => {
      setSettings((current) => ({
        periods: {
          ...current.periods,
          [period]: {
            ...current.periods[period],
            [key]: {
              ...(current.periods[period][key] ?? EMPTY_COST_VALUES),
              [field]: setDailyValue(current.periods[period][key]?.[field] ?? '', value),
            },
          },
        },
      }));
    },
    [],
  );

  return {
    addFieldValue,
    getMonthlySum,
    getLatestDailyValue,
    getValues,
    isHydrated,
    setFieldValue,
    updateField,
  };
}

function settingsEquivalent(left: CostSettings, right: CostSettings): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function parseCostNumber(value: string): number {
  const raw = value.trim().replace(/R\$\s?/g, '');
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}
