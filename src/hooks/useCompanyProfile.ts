import { useCallback, useEffect, useState } from 'react';

import {
  companyProfileStorage,
  EMPTY_COMPANY_PROFILE,
  type CompanyProfile,
} from '@/services/company';

export function useCompanyProfile() {
  const [profile, setProfile] = useState<CompanyProfile>({ ...EMPTY_COMPANY_PROFILE });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void companyProfileStorage.load().then((storedProfile) => {
      if (!isMounted) return;
      setProfile(storedProfile);
      setIsHydrated(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isHydrated) void companyProfileStorage.save(profile);
  }, [isHydrated, profile]);

  const updateField = useCallback(
    <K extends keyof CompanyProfile>(field: K, value: CompanyProfile[K]) => {
      setProfile((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  return { isHydrated, profile, updateField };
}
