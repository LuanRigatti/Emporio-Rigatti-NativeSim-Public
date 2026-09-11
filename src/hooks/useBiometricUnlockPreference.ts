import { useCallback, useEffect, useState } from 'react';

import { biometricService } from '@/services/biometrics';
import { biometricUnlockPreferenceStorage } from '@/services/biometrics/BiometricUnlockPreferenceStorage';

export type BiometricPreferenceUpdateResult =
  | { enabled: true; success: true }
  | { enabled: false; success: true }
  | { reason: 'authentication_failed' | 'unavailable'; success: false };

export function useBiometricUnlockPreference() {
  const cachedValue = biometricUnlockPreferenceStorage.getCached();
  const [enabled, setEnabled] = useState<boolean | undefined>(cachedValue);
  const [isHydrated, setIsHydrated] = useState(cachedValue !== undefined);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = biometricUnlockPreferenceStorage.subscribe((nextEnabled) => {
      if (!mounted) return;
      setEnabled(nextEnabled);
      setIsHydrated(true);
    });

    void biometricUnlockPreferenceStorage.load().then((nextEnabled) => {
      if (!mounted) return;
      setEnabled(nextEnabled);
      setIsHydrated(true);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const updateEnabled = useCallback(
    async (nextEnabled: boolean): Promise<BiometricPreferenceUpdateResult> => {
      if (!nextEnabled) {
        await biometricUnlockPreferenceStorage.save(false);
        return { enabled: false, success: true };
      }

      const support = await biometricService.getSupport();
      if (!support.hasHardware || !support.isEnrolled || !support.supportsFaceId) {
        return { reason: 'unavailable', success: false };
      }

      const result = await biometricService.authenticate();
      if (!result.success) {
        return { reason: 'authentication_failed', success: false };
      }

      await biometricUnlockPreferenceStorage.save(true);
      return { enabled: true, success: true };
    },
    [],
  );

  return {
    enabled: enabled ?? false,
    isHydrated,
    updateEnabled,
  };
}
