import { useCallback, useEffect, useRef, useState } from 'react';

import { ENABLE_FIRESTORE_CAR_SETTINGS } from '@/config/featureFlags';
import { useAuth } from '@/providers';
import {
  carSettingsStorage,
  EMPTY_CAR_SETTINGS,
  firestoreCarSettingsDataSource,
  type CarSettings,
} from '@/services/car';

export function useCarSettings() {
  const { user } = useAuth();
  const userId = user?.id;
  const [settings, setSettings] = useState<CarSettings>({ ...EMPTY_CAR_SETTINGS });
  const [isHydrated, setIsHydrated] = useState(false);
  const [remoteActive, setRemoteActive] = useState(false);
  const previousSettings = useRef<CarSettings | null>(null);
  const remoteUserId = useRef<string | undefined>(undefined);
  const skipRemoteSync = useRef(false);

  useEffect(() => {
    let isMounted = true;
    skipRemoteSync.current = false;

    void (async () => {
      const storedSettings = await carSettingsStorage.load();
      if (!isMounted) return;

      remoteUserId.current = undefined;
      previousSettings.current = storedSettings;
      setSettings(storedSettings);
      setIsHydrated(true);
      setRemoteActive(false);

      if (ENABLE_FIRESTORE_CAR_SETTINGS && userId) {
        try {
          const remoteSettings = await firestoreCarSettingsDataSource.load(userId);
          if (!isMounted) return;
          if (remoteSettings) {
            previousSettings.current = remoteSettings;
            setSettings(remoteSettings);
          }
          skipRemoteSync.current = true;
          remoteUserId.current = userId;
          setRemoteActive(true);
        } catch (error) {
          if (__DEV__) console.warn('[useCarSettings] Firestore fallback local.', error);
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
    void carSettingsStorage.save(settings);

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
    void firestoreCarSettingsDataSource.save(userId, settings).catch((error) => {
      if (__DEV__) console.warn('[useCarSettings] Firestore save fallback local.', error);
      setRemoteActive(false);
    });
  }, [isHydrated, remoteActive, settings, userId]);

  const updateField = useCallback(
    <K extends keyof CarSettings>(field: K, value: CarSettings[K]) => {
      setSettings((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  return { isHydrated, settings, updateField };
}
