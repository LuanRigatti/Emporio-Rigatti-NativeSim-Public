import { useCallback, useEffect, useState } from 'react';

import {
  EMPTY_FACTORY_SETTINGS,
  factorySettingsStorage,
  type FactorySettings,
} from '@/services/factory';

export function useFactorySettings() {
  const [settings, setSettings] = useState<FactorySettings>({ ...EMPTY_FACTORY_SETTINGS });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void factorySettingsStorage.load().then((storedSettings) => {
      if (!isMounted) return;
      setSettings(storedSettings);
      setIsHydrated(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isHydrated) void factorySettingsStorage.save(settings);
  }, [isHydrated, settings]);

  const updateField = useCallback(
    <K extends keyof FactorySettings>(field: K, value: FactorySettings[K]) => {
      setSettings((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  return { isHydrated, settings, updateField };
}
