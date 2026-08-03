import { useCallback, useEffect, useState } from 'react';

import { carSettingsStorage, EMPTY_CAR_SETTINGS, type CarSettings } from '@/services/car';

export function useCarSettings() {
  const [settings, setSettings] = useState<CarSettings>({ ...EMPTY_CAR_SETTINGS });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void carSettingsStorage.load().then((storedSettings) => {
      if (!isMounted) return;
      setSettings(storedSettings);
      setIsHydrated(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isHydrated) void carSettingsStorage.save(settings);
  }, [isHydrated, settings]);

  const updateField = useCallback(
    <K extends keyof CarSettings>(field: K, value: CarSettings[K]) => {
      setSettings((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  return { isHydrated, settings, updateField };
}
