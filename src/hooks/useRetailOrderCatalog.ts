import { useCallback, useEffect, useRef } from 'react';

import { useAuth } from '@/providers';
import { retailCategoryDataSource, retailProductDataSource } from '@/services/retail-catalog';
import {
  retailCompositionDataSource,
  retailCostEntryDataSource,
  retailCostItemDataSource,
} from '@/services/retail-costs';
import type { RetailCompositionVersion } from '@/types/data';
import type { RetailOrderCatalogContext } from '@/services/retail-orders';

import { useRetailCategories } from './useRetailCategories';
import { useRetailClients } from './useRetailClients';
import { useRetailCostItems } from './useRetailCostItems';
import { useRetailProducts } from './useRetailProducts';

const ALL_CATEGORIES_QUERY = { includeInactive: true } as const;
const ALL_COST_ITEMS_QUERY = { includeInactive: true } as const;

type RetailOrderPreparationOptions = {
  referenceDate?: string;
  refresh?: boolean;
};

export function useRetailOrderCatalog() {
  const { sessionVersion, user } = useAuth();
  const clients = useRetailClients();
  const products = useRetailProducts();
  const categories = useRetailCategories(ALL_CATEGORIES_QUERY);
  const costItems = useRetailCostItems(ALL_COST_ITEMS_QUERY);
  const userId = user?.id;
  const categorySnapshot = retailCategoryDataSource.getSnapshot(userId, sessionVersion);
  const costItemSnapshot = retailCostItemDataSource.getSnapshot(userId, sessionVersion);
  const productSnapshot = retailProductDataSource.getSnapshot(userId, sessionVersion);
  const preparedContexts = useRef(new Map<string, RetailOrderCatalogContext>());

  const clearPreparedContexts = useCallback(() => {
    preparedContexts.current.clear();
  }, []);

  useEffect(() => {
    clearPreparedContexts();
  }, [
    categorySnapshot,
    clearPreparedContexts,
    costItemSnapshot,
    productSnapshot,
    sessionVersion,
    userId,
  ]);

  useEffect(
    () => retailCompositionDataSource.subscribe(clearPreparedContexts),
    [clearPreparedContexts],
  );

  useEffect(
    () => retailCostEntryDataSource.subscribe(clearPreparedContexts),
    [clearPreparedContexts],
  );

  const prepareForOrder = useCallback(
    async (
      productIds: readonly string[],
      { referenceDate = '', refresh = true }: RetailOrderPreparationOptions = {},
    ): Promise<RetailOrderCatalogContext> => {
      if (!userId) throw new Error('Sessão autenticada indisponível.');
      const selectedProductIds = [...new Set(productIds)].sort();
      if (!selectedProductIds.length) {
        throw new Error('Adicione ao menos um produto ao pedido.');
      }

      const cacheKey = `${userId}:${sessionVersion ?? 'unknown'}:${referenceDate}:${selectedProductIds.join(',')}`;
      const prepared = preparedContexts.current.get(cacheKey);
      if (prepared && !refresh) return prepared;

      await Promise.all(
        [
          [
            retailCategoryDataSource.getSnapshot(userId, sessionVersion),
            () => retailCategoryDataSource.load(userId, sessionVersion),
          ],
          [
            retailCostItemDataSource.getSnapshot(userId, sessionVersion),
            () => retailCostItemDataSource.load(userId, sessionVersion),
          ],
          [
            retailProductDataSource.getSnapshot(userId, sessionVersion),
            () => retailProductDataSource.load(userId, sessionVersion),
          ],
        ]
          .flatMap(([snapshot, load]) =>
            refresh || snapshot === null ? [load as () => Promise<void>] : [],
          )
          .map((load) => load()),
      );

      const selectedProducts = retailProductDataSource.list(
        { includeInactive: true },
        userId,
        sessionVersion,
      );
      const compositionProductIds = selectedProductIds.filter((productId) =>
        selectedProducts.some(
          (product) => product.productId === productId && product.costMode === 'composition',
        ),
      );

      await Promise.all(
        compositionProductIds
          .filter(
            (productId) =>
              refresh ||
              retailCompositionDataSource.getSnapshot(productId, userId, sessionVersion) === null,
          )
          .map((productId) => retailCompositionDataSource.load(productId, userId, sessionVersion)),
      );

      const compositionVersionsByProductId = new Map<string, readonly RetailCompositionVersion[]>();
      const costItemIds = new Set<string>();

      selectedProducts.forEach((product) => {
        if (!selectedProductIds.includes(product.productId)) return;
        if (product.costMode === 'direct' && product.directCostItemId) {
          costItemIds.add(product.directCostItemId);
        }
        if (product.costMode !== 'composition') return;
        const versions = retailCompositionDataSource.list(
          product.productId,
          userId,
          sessionVersion,
        );
        compositionVersionsByProductId.set(product.productId, versions);
        versions.forEach((version) =>
          version.components.forEach((component) => costItemIds.add(component.costItemId)),
        );
      });

      await Promise.all(
        [...costItemIds]
          .filter(
            (costItemId) =>
              refresh ||
              retailCostEntryDataSource.getSnapshot(costItemId, userId, sessionVersion) === null,
          )
          .map((costItemId) => retailCostEntryDataSource.load(costItemId, userId, sessionVersion)),
      );

      if (
        retailProductDataSource.getSnapshot(userId, sessionVersion) === null ||
        retailCategoryDataSource.getSnapshot(userId, sessionVersion) === null ||
        retailCostItemDataSource.getSnapshot(userId, sessionVersion) === null
      ) {
        throw new Error('Sessão alterada durante a preparação do pedido.');
      }

      const costEntriesByItemId = new Map(
        [...costItemIds].map(
          (costItemId) =>
            [
              costItemId,
              retailCostEntryDataSource.list(costItemId, userId, sessionVersion),
            ] as const,
        ),
      );

      const context = {
        categories: retailCategoryDataSource.list({}, userId, sessionVersion),
        compositionVersionsByProductId,
        costEntriesByItemId,
        costItems: retailCostItemDataSource.list(ALL_COST_ITEMS_QUERY, userId, sessionVersion),
        products: selectedProducts,
      };
      preparedContexts.current.set(cacheKey, context);
      return context;
    },
    [sessionVersion, userId],
  );

  const prefetchForOrder = useCallback(
    (productIds: readonly string[], referenceDate: string) =>
      prepareForOrder(productIds, { referenceDate, refresh: false }).catch(() => undefined),
    [prepareForOrder],
  );

  return {
    categories: categories.categories,
    clients: clients.clients,
    error: clients.error ?? products.error ?? categories.error ?? costItems.error,
    loading: clients.loading || products.loading || categories.loading || costItems.loading,
    prefetchForOrder,
    prepareForOrder,
    products: products.products,
  };
}
