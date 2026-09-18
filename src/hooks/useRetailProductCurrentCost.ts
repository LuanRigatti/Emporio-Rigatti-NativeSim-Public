import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/providers';
import { retailCostEntryDataSource, resolveRetailProductCost } from '@/services/retail-costs';
import type { RetailCostItem, RetailProduct, RetailProductCostMode } from '@/types/data';
import { todayIso } from '@/utils/data';

import { useRetailCompositions } from './useRetailCompositions';

export type RetailProductCurrentCostState = {
  mode: RetailProductCostMode | '';
  referenceDate: string;
  status: 'loading' | 'available' | 'unavailable' | 'incomplete';
  cost?: number;
  message?: string;
};

export type RetailProductCurrentCostOptions = {
  costItemsLoading?: boolean;
};

type CostEntriesLoadState = {
  key: string;
  status: 'ready' | 'error';
  message?: string;
};

export function useRetailProductCurrentCost(
  product: RetailProduct | null | undefined,
  costItems: readonly RetailCostItem[],
  options: RetailProductCurrentCostOptions = {},
): RetailProductCurrentCostState {
  const { sessionVersion, user } = useAuth();
  const userId = user?.id;
  const referenceDate = todayIso();
  const compositionProductId = product?.costMode === 'composition' ? product.productId : undefined;
  const {
    error: compositionError,
    loading: compositionsLoading,
    snapshot: compositionSnapshot,
    versions,
  } = useRetailCompositions(compositionProductId);
  const compositionCostItemIdKey = [
    ...new Set(
      versions.flatMap((version) => version.components.map((component) => component.costItemId)),
    ),
  ].join('|');
  const costMode = product?.costMode;
  const directCostItemId = product?.directCostItemId;
  const relevantCostItemIds = useMemo(() => {
    if (costMode === 'direct') {
      return directCostItemId ? [directCostItemId] : [];
    }
    if (costMode !== 'composition' || !compositionCostItemIdKey) return [];
    return compositionCostItemIdKey.split('|');
  }, [compositionCostItemIdKey, costMode, directCostItemId]);
  const [costEntriesLoadState, setCostEntriesLoadState] = useState<CostEntriesLoadState>();
  const costLoadKey = `${userId ?? ''}:${sessionVersion ?? ''}:${relevantCostItemIds.join('|')}`;
  const getEntriesSignature = useCallback(
    () =>
      relevantCostItemIds
        .map((costItemId) => {
          const snapshot = retailCostEntryDataSource.getSnapshot(
            costItemId,
            userId,
            sessionVersion,
          );
          if (snapshot === null) return `${costItemId}:pending`;
          return `${costItemId}:${snapshot
            .map((entry) => `${entry.entryId}:${entry.effectiveDate}:${entry.normalizedUnitCost}`)
            .join(',')}`;
        })
        .join('|'),
    [relevantCostItemIds, sessionVersion, userId],
  );
  useSyncExternalStore(
    retailCostEntryDataSource.subscribe,
    getEntriesSignature,
    getEntriesSignature,
  );

  useEffect(() => {
    if (!userId || !relevantCostItemIds.length) return;
    let cancelled = false;
    void Promise.all(
      relevantCostItemIds.map((costItemId) =>
        retailCostEntryDataSource.load(costItemId, userId, sessionVersion),
      ),
    )
      .then(() => {
        if (!cancelled) setCostEntriesLoadState({ key: costLoadKey, status: 'ready' });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setCostEntriesLoadState({
            key: costLoadKey,
            message:
              error instanceof Error
                ? error.message
                : 'Não foi possível carregar o histórico de custos.',
            status: 'error',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [costLoadKey, relevantCostItemIds, sessionVersion, userId]);

  const entriesByItemId = new Map(
    relevantCostItemIds.map(
      (costItemId) =>
        [costItemId, retailCostEntryDataSource.list(costItemId, userId, sessionVersion)] as const,
    ),
  );
  const hasKnownEntriesForEveryItem = Boolean(
    userId &&
    relevantCostItemIds.length &&
    relevantCostItemIds.every(
      (costItemId) =>
        (retailCostEntryDataSource.getSnapshot(costItemId, userId, sessionVersion)?.length ?? 0) >
        0,
    ),
  );
  const costEntriesLoadSettled = costEntriesLoadState?.key === costLoadKey;
  const entriesLoading = Boolean(
    userId && relevantCostItemIds.length && !hasKnownEntriesForEveryItem && !costEntriesLoadSettled,
  );
  const activeLoadError =
    costEntriesLoadState?.key === costLoadKey &&
    costEntriesLoadState.status === 'error' &&
    !hasKnownEntriesForEveryItem
      ? costEntriesLoadState.message
      : undefined;
  const mode = product?.costMode ?? '';

  if (!product) {
    return {
      message: 'Salve o produto para resolver o custo atual.',
      mode,
      referenceDate,
      status: 'unavailable',
    };
  }
  if ((product.costMode === 'composition' && compositionError) || activeLoadError) {
    return {
      message:
        (product.costMode === 'composition' ? compositionError : undefined) ?? activeLoadError,
      mode,
      referenceDate,
      status: 'unavailable',
    };
  }
  if (
    options.costItemsLoading ||
    (product.costMode === 'composition' && (compositionsLoading || compositionSnapshot === null)) ||
    entriesLoading
  ) {
    return { mode, referenceDate, status: 'loading' };
  }

  const resolution = resolveRetailProductCost({
    compositionVersions: versions,
    costEntriesByItemId: entriesByItemId,
    costItems,
    product,
    referenceDate,
  });
  return {
    ...(resolution.status === 'available' ? { cost: resolution.cost } : {}),
    ...(resolution.status !== 'available' && resolution.message
      ? { message: resolution.message }
      : {}),
    mode,
    referenceDate,
    status: resolution.status,
  };
}
