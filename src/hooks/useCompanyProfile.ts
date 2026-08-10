import { useCallback, useEffect, useRef, useState } from 'react';

import { ENABLE_FIRESTORE_COMPANY_PROFILE } from '@/config/featureFlags';
import { useAuth } from '@/providers';
import {
  companyProfileStorage,
  EMPTY_COMPANY_PROFILE,
  firestoreCompanyProfileDataSource,
  type CompanyProfile,
} from '@/services/company';

export function useCompanyProfile() {
  const { user } = useAuth();
  const userId = user?.id;
  const [profile, setProfile] = useState<CompanyProfile>({ ...EMPTY_COMPANY_PROFILE });
  const [isHydrated, setIsHydrated] = useState(false);
  const [remoteActive, setRemoteActive] = useState(false);
  const previousProfile = useRef<CompanyProfile | null>(null);
  const remoteUserId = useRef<string | undefined>(undefined);
  const skipRemoteSync = useRef(false);

  useEffect(() => {
    let isMounted = true;
    skipRemoteSync.current = false;

    void (async () => {
      const storedProfile = await companyProfileStorage.load();
      if (!isMounted) return;

      remoteUserId.current = undefined;
      previousProfile.current = storedProfile;
      setProfile(storedProfile);
      setIsHydrated(true);
      setRemoteActive(false);

      if (ENABLE_FIRESTORE_COMPANY_PROFILE && userId) {
        try {
          const remoteProfile = await firestoreCompanyProfileDataSource.load(userId);
          if (!isMounted) return;
          if (remoteProfile) {
            previousProfile.current = remoteProfile;
            setProfile(remoteProfile);
          }
          skipRemoteSync.current = true;
          remoteUserId.current = userId;
          setRemoteActive(true);
        } catch (error) {
          if (__DEV__) console.warn('[useCompanyProfile] Firestore fallback local.', error);
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
    void companyProfileStorage.save(profile);

    if (!remoteActive || !userId || remoteUserId.current !== userId) {
      previousProfile.current = profile;
      return;
    }
    if (skipRemoteSync.current) {
      skipRemoteSync.current = false;
      previousProfile.current = profile;
      return;
    }
    if (JSON.stringify(previousProfile.current) === JSON.stringify(profile)) return;

    previousProfile.current = profile;
    void firestoreCompanyProfileDataSource.save(userId, profile).catch((error) => {
      if (__DEV__) console.warn('[useCompanyProfile] Firestore save fallback local.', error);
      setRemoteActive(false);
    });
  }, [isHydrated, profile, remoteActive, userId]);

  const updateField = useCallback(
    <K extends keyof CompanyProfile>(field: K, value: CompanyProfile[K]) => {
      setProfile((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  return { isHydrated, profile, updateField };
}
