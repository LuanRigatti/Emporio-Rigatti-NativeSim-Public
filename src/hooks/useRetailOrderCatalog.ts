import { useCallback } from 'react';

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

export function useRetailOrderCatalog() {
  const { sessionVersion, user } = useAuth();
  const clients = useRetailClients();
  const products = useRetailProducts();
  const categories = useRetailCategories(ALL_CATEGORIES_QUERY);
  const costItems = useRetailCostItems(ALL_COST_ITEMS_QUERY);
  const userId = user?.id;

  const prepareForOrder = useCallback(
    async (productIds: readonly string[]): Promise<RetailOrderCatalogContext> => {
      if (!userId) throw new Error('Sessão autenticada indisponível.');
      const selectedProductIds = [...new Set(productIds)];
      if (!selectedProductIds.length) {
        throw new Error('Adicione ao menos um produto ao pedido.');
      }

      await Promise.all([
        retailCategoryDataSource.load(userId, sessionVersion),
        retailCostItemDataSource.load(userId, sessionVersion),
        retailProductDataSource.load(userId, sessionVersion),
      ]);

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
        compositionProductIds.map((productId) =>
          retailCompositionDataSource.load(productId, userId, sessionVersion),
        ),
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
        [...costItemIds].map((costItemId) =>
          retailCostEntryDataSource.load(costItemId, userId, sessionVersion),
        ),
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

      return {
        categories: retailCategoryDataSource.list({}, userId, sessionVersion),
        compositionVersionsByProductId,
        costEntriesByItemId,
        costItems: retailCostItemDataSource.list(ALL_COST_ITEMS_QUERY, userId, sessionVersion),
        products: selectedProducts,
      };
    },
    [sessionVersion, userId],
  );

  return {
    categories: categories.categories,
    clients: clients.clients,
    error: clients.error ?? products.error ?? categories.error ?? costItems.error,
    loading: clients.loading || products.loading || categories.loading || costItems.loading,
    prepareForOrder,
    products: products.products,
  };
}
