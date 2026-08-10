import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/providers';
import type { FactoryFilters, FactoryReceipt } from '@/types/data';
import {
  factoryReceiptDataSource,
  factoryReceiptToPurchase,
  factoryReceiptsToPurchases,
  type CreatePurchaseInput,
} from '@/services/factory-purchases';

export function useFactoryPurchases(filters: FactoryFilters = { period: 'all' }) {
  const { status: authStatus, user } = useAuth();
  const { month, period } = filters;
  const stableFilters = useMemo(
    () => ({ period, ...(month ? { month } : {}) }),
    [month, period],
  );
  const [receipts, setReceipts] = useState<FactoryReceipt[]>(() =>
    factoryReceiptDataSource.getReceipts(),
  );

  useEffect(() => {
    if (factoryReceiptDataSource.mode === 'firebase' && authStatus === 'loading') return;
    let active = true;
    void factoryReceiptDataSource.restore(user?.id, stableFilters).then(() => {
      if (active) setReceipts(factoryReceiptDataSource.getReceipts());
    });
    return () => {
      active = false;
    };
  }, [authStatus, stableFilters, user?.id]);

  const refresh = useCallback(async () => {
    await factoryReceiptDataSource.restore(user?.id, stableFilters);
    setReceipts(factoryReceiptDataSource.getReceipts());
  }, [stableFilters, user?.id]);

  const createPurchase = useCallback(async (input: CreatePurchaseInput) => {
    const receipt = await factoryReceiptDataSource.createReceipt({
        bucketUnitPrice: input.bucketUnitPrice,
        date: input.date,
        quantity: input.bucketQuantity,
      });
    setReceipts(factoryReceiptDataSource.getReceipts());
    return factoryReceiptToPurchase(receipt);
  }, []);

  const addPayment = useCallback(
    async (purchaseId: string, payment: { date: string; amount: number }) => {
      const receipt = await factoryReceiptDataSource.addPayment(purchaseId, payment);
      setReceipts(factoryReceiptDataSource.getReceipts());
      return factoryReceiptToPurchase(receipt);
    },
    [],
  );

  const deletePurchase = useCallback(async (purchaseId: string) => {
    await factoryReceiptDataSource.deleteReceipt(purchaseId);
    setReceipts(factoryReceiptDataSource.getReceipts());
  }, []);

  const removePayment = useCallback(async (purchaseId: string, paymentId: string) => {
    const receipt = await factoryReceiptDataSource.removePayment(purchaseId, paymentId);
    setReceipts(factoryReceiptDataSource.getReceipts());
    return factoryReceiptToPurchase(receipt);
  }, []);

  const purchases = useMemo(() => factoryReceiptsToPurchases(receipts), [receipts]);

  const purchaseById = useMemo(
    () => new Map(purchases.map((purchase) => [purchase.id, purchase])),
    [purchases],
  );

  return {
    addPayment,
    createPurchase,
    deletePurchase,
    purchaseById,
    purchases,
    receipts,
    refresh,
    removePayment,
  };
}
