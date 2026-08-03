import { useCallback, useEffect, useState } from 'react';

import {
  costSettingsStorage,
  EMPTY_COST_VALUES,
  type CostField,
  type CostPeriod,
  type CostSettings,
  type CostValues,
} from '@/services/costs';

export function useCostSettings() {
  const [settings, setSettings] = useState<CostSettings>({
    periods: { day: {}, month: {}, year: {} },
  });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void costSettingsStorage.load().then((storedSettings) => {
      if (!isMounted) return;
      setSettings(storedSettings);
      setIsHydrated(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isHydrated) void costSettingsStorage.save(settings);
  }, [isHydrated, settings]);

  const getValues = useCallback(
    (period: CostPeriod, key: string): CostValues =>
      settings.periods[period][key] ?? { ...EMPTY_COST_VALUES },
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

  return { getMonthlySum, getValues, isHydrated, updateField };
}

function parseCostNumber(value: string): number {
  const raw = value.trim().replace(/R\$\s?/g, '');
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}
