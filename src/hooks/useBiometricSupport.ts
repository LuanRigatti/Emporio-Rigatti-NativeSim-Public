import { useEffect, useState } from 'react';

import { ENABLE_BIOMETRIC_UNLOCK } from '@/config/featureFlags';
import { biometricService, type BiometricSupport } from '@/services/biometrics';

const initialSupport: BiometricSupport = biometricService.getUnavailableSupport();

export function useBiometricSupport() {
  const [support, setSupport] = useState<BiometricSupport>(initialSupport);
  const [isLoading, setIsLoading] = useState(ENABLE_BIOMETRIC_UNLOCK);

  useEffect(() => {
    if (!ENABLE_BIOMETRIC_UNLOCK) {
      return undefined;
    }

    let isMounted = true;

    void biometricService
      .getSupport()
      .then((nextSupport) => {
        if (isMounted) {
          setSupport(nextSupport);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { enabled: ENABLE_BIOMETRIC_UNLOCK, isLoading, support };
}
