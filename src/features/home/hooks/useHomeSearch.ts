import { useCallback, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/providers';

import { AppHomeSearchDataSource } from '../search/HomeSearchDataSource';
import { HomeSearchService } from '../search/HomeSearchService';
import type { HomeSearchResponse } from '../search/HomeSearchTypes';

export function useHomeSearch() {
  const { user } = useAuth();
  const userId = user?.id;
  const service = useMemo(
    () => (userId ? new HomeSearchService(new AppHomeSearchDataSource(userId)) : null),
    [userId],
  );
  const requestVersion = useRef(0);
  const [response, setResponse] = useState<HomeSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    async (query: string): Promise<HomeSearchResponse | undefined> => {
      const version = ++requestVersion.current;
      if (!service) {
        return undefined;
      }
      setLoading(true);
      const nextResponse = await service.search(query);
      if (version !== requestVersion.current || nextResponse.stale) {
        return nextResponse;
      }
      setResponse(nextResponse);
      setLoading(false);
      return nextResponse;
    },
    [service],
  );

  return { search, response, loading };
}
