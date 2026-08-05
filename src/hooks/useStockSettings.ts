import { useCallback, useEffect, useState } from 'react';

import {
  EMPTY_STOCK_PERIOD_SETTINGS,
  EMPTY_STOCK_SETTINGS,
  stockSettingsStorage,
  type StockPeriodSettings,
  type StockSettings,
} from '@/services/stock';

export type StockSettingsField = keyof StockPeriodSettings;

export function useStockSettings() {
  const [settings, setSettings] = useState<StockSettings>({ ...EMPTY_STOCK_SETTINGS });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void stockSettingsStorage.load().then((storedSettings) => {
      if (!isMounted) return;
      setSettings(storedSettings);
      setIsHydrated(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isHydrated) void stockSettingsStorage.save(settings);
  }, [isHydrated, settings]);

  const getValues = useCallback(
    (periodKey: string): StockPeriodSettings =>
      settings.periods[periodKey] ?? { ...EMPTY_STOCK_PERIOD_SETTINGS },
    [settings.periods],
  );

  const updateField = useCallback((periodKey: string, field: StockSettingsField, value: string) => {
    setSettings((current) => ({
      periods: {
        ...current.periods,
        [periodKey]: {
          ...(current.periods[periodKey] ?? EMPTY_STOCK_PERIOD_SETTINGS),
          [field]: value.replace(/[^0-9]/g, ''),
        },
      },
    }));
  }, []);

  return { getValues, isHydrated, updateField };
}
