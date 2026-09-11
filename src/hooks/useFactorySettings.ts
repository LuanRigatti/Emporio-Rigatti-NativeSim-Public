import { useCallback, useEffect, useRef, useState } from 'react';

import { ENABLE_FIRESTORE_FACTORY_SETTINGS } from '@/config/featureFlags';
import { useAuth } from '@/providers';
import {
  EMPTY_FACTORY_SETTINGS,
  factorySettingsStorage,
  firestoreFactorySettingsDataSource,
  type FactorySettings,
} from '@/services/factory';

export function useFactorySettings() {
  const { user } = useAuth();
  const userId = user?.id;
  const [settings, setSettings] = useState<FactorySettings>({ ...EMPTY_FACTORY_SETTINGS });
  const [isHydrated, setIsHydrated] = useState(false);
  const [remoteActive, setRemoteActive] = useState(false);
  const previousSettings = useRef<FactorySettings | null>(null);
  const remoteUserId = useRef<string | undefined>(undefined);
  const skipRemoteSync = useRef(false);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const storedSettings = await factorySettingsStorage.load();
      if (!isMounted) return;

      remoteUserId.current = undefined;
      previousSettings.current = storedSettings;
      setSettings(storedSettings);
      setIsHydrated(true);
      setRemoteActive(false);

      if (ENABLE_FIRESTORE_FACTORY_SETTINGS && userId) {
        try {
          const remoteSettings = await firestoreFactorySettingsDataSource.load(userId);
          if (!isMounted) return;
          if (remoteSettings) {
            previousSettings.current = remoteSettings;
            setSettings(remoteSettings);
          }
          skipRemoteSync.current = true;
          remoteUserId.current = userId;
          setRemoteActive(true);
        } catch (error) {
          if (__DEV__) console.warn('[useFactorySettings] Firestore fallback local.', error);
          if (!isMounted) return;
          setRemoteActive(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!isHydrated) return;
    void factorySettingsStorage.save(settings);

    if (!remoteActive || !userId || remoteUserId.current !== userId) {
      previousSettings.current = settings;
      return;
    }
    if (skipRemoteSync.current) {
      skipRemoteSync.current = false;
      previousSettings.current = settings;
      return;
    }
    if (JSON.stringify(previousSettings.current) === JSON.stringify(settings)) return;

    previousSettings.current = settings;
    void firestoreFactorySettingsDataSource.save(userId, settings).catch((error) => {
      if (__DEV__) console.warn('[useFactorySettings] Firestore save fallback local.', error);
      setRemoteActive(false);
    });
  }, [isHydrated, remoteActive, settings, userId]);

  const updateField = useCallback(
    <K extends keyof FactorySettings>(field: K, value: FactorySettings[K]) => {
      setSettings((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  return { isHydrated, settings, updateField };
}
