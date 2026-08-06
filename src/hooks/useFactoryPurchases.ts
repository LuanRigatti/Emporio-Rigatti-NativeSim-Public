import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Purchase } from '@/features/factory-purchases/types';
import {
  mockFactoryPurchaseDataSource,
  type CreatePurchaseInput,
} from '@/services/factory-purchases';

export function useFactoryPurchases() {
  const [purchases, setPurchases] = useState<Purchase[]>(() =>
    mockFactoryPurchaseDataSource.getPurchases(),
  );

  useEffect(() => {
    let active = true;
    void mockFactoryPurchaseDataSource.restore().then(() => {
      if (active) setPurchases(mockFactoryPurchaseDataSource.getPurchases());
    });
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(() => {
    setPurchases(mockFactoryPurchaseDataSource.getPurchases());
  }, []);

  const createPurchase = useCallback((input: CreatePurchaseInput) => {
    const purchase = mockFactoryPurchaseDataSource.createPurchase(input);
    setPurchases(mockFactoryPurchaseDataSource.getPurchases());
    return purchase;
  }, []);

  const addPayment = useCallback(
    (purchaseId: string, payment: { date: string; amount: number }) => {
      const purchase = mockFactoryPurchaseDataSource.addPayment(purchaseId, payment);
      setPurchases(mockFactoryPurchaseDataSource.getPurchases());
      return purchase;
    },
    [],
  );

  const deletePurchase = useCallback((purchaseId: string) => {
    mockFactoryPurchaseDataSource.deletePurchase(purchaseId);
    setPurchases(mockFactoryPurchaseDataSource.getPurchases());
  }, []);

  const purchaseById = useMemo(
    () => new Map(purchases.map((purchase) => [purchase.id, purchase])),
    [purchases],
  );

  return { addPayment, createPurchase, deletePurchase, purchaseById, purchases, refresh };
}
