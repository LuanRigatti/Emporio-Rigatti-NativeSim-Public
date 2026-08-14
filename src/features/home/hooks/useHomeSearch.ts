import { useCallback, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/providers';

import { logHomeSearchFlow } from '../debug/HomeSearchFlowDebug';
import { AppHomeSearchDataSource } from '../search/HomeSearchDataSource';
import { HomeSearchService } from '../search/HomeSearchService';
import type { HomeSearchResponse } from '../search/HomeSearchTypes';

function logSearch(response: HomeSearchResponse): void {
  if (!__DEV__) return;
  const { query } = response;
  console.log('[home-search]', {
    queryOriginal: query.original,
    queryNormalized: query.normalized,
    detected: {
      types: query.detectedTypes,
      filters: {
        ...(query.period ? { period: query.period } : {}),
        ...(query.quantity !== undefined ? { quantity: query.quantity } : {}),
        ...(query.money !== undefined ? { money: query.money } : {}),
        ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
        ...(query.documentType ? { documentType: query.documentType } : {}),
        ...(query.financialMetric ? { financialMetric: query.financialMetric } : {}),
        ...(query.clientField ? { clientField: query.clientField } : {}),
        ...(query.factoryMetric ? { factoryMetric: query.factoryMetric } : {}),
        ...(query.factoryStatus ? { factoryStatus: query.factoryStatus } : {}),
        ...(query.routeMetric ? { routeMetric: query.routeMetric } : {}),
        ...(query.carMetric ? { carMetric: query.carMetric } : {}),
        ...(query.periodSummary ? { periodSummary: true } : {}),
        ...(query.text ? { text: query.text } : {}),
      },
    },
    coverage: response.coverage,
    counts: response.counts,
    results: response.results.map(({ id, type }) => ({ id, type })),
    durationMs: response.durationMs,
    errors: response.errors,
  });
}

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
        logHomeSearchFlow('search-unavailable', { searchId: version });
        return undefined;
      }
      logHomeSearchFlow('search-started', { searchId: version });
      setLoading(true);
      const nextResponse = await service.search(query);
      logHomeSearchFlow('search-completed', {
        searchId: version,
        resultCount: nextResponse.results.length,
        stale: nextResponse.stale,
        superseded: version !== requestVersion.current,
      });
      if (version !== requestVersion.current || nextResponse.stale) {
        logHomeSearchFlow('response-not-published', { searchId: version });
        return nextResponse;
      }
      setResponse(nextResponse);
      setLoading(false);
      logHomeSearchFlow('response-published', { searchId: version });
      logSearch(nextResponse);
      return nextResponse;
    },
    [service],
  );

  return { search, response, loading };
}
