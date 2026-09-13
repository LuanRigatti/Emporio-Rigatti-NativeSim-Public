import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/providers';

import { AppHomeSearchDataSource } from '../search/HomeSearchDataSource';
import { HomeSearchService } from '../search/HomeSearchService';
import type { HomeSearchResponse } from '../search/HomeSearchTypes';

export function useHomeSearch() {
  const { sessionVersion, user } = useAuth();
  const userId = user?.id;
  const service = useMemo(
    () =>
      userId
        ? new HomeSearchService(new AppHomeSearchDataSource(userId, undefined, sessionVersion))
        : null,
    [sessionVersion, userId],
  );
  const sessionKey = `${sessionVersion}:${userId ?? ''}`;
  const requestVersion = useRef(0);
  const [responseState, setResponseState] = useState<{
    sessionKey: string;
    response: HomeSearchResponse;
  } | null>(null);
  const [loadingState, setLoadingState] = useState<{ sessionKey: string; value: boolean }>({
    sessionKey: '',
    value: false,
  });

  useEffect(() => {
    requestVersion.current += 1;
  }, [sessionKey]);

  const search = useCallback(
    async (query: string): Promise<HomeSearchResponse | undefined> => {
      const version = ++requestVersion.current;
      if (!service) {
        return undefined;
      }
      setLoadingState({ sessionKey, value: true });
      const nextResponse = await service.search(query);
      if (version !== requestVersion.current || nextResponse.stale) {
        return nextResponse;
      }
      setResponseState({ sessionKey, response: nextResponse });
      setLoadingState({ sessionKey, value: false });
      return nextResponse;
    },
    [service, sessionKey],
  );

  return {
    search,
    response: responseState?.sessionKey === sessionKey ? responseState.response : null,
    loading: loadingState.sessionKey === sessionKey && loadingState.value,
  };
}
