import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/providers';
import { factoryReceiptQueryService } from '@/services/finance';
import type { FactoryFilters, FactoryReceipt } from '@/types/data';
import {
  factoryReceiptDataSource,
  factoryReceiptToPurchase,
  factoryReceiptsToPurchases,
  type CreatePurchaseInput,
} from '@/services/factory-purchases';

export function useFactoryPurchases(filters: FactoryFilters = { period: 'all' }) {
  const { status: authStatus, user } = useAuth();
  const { endDate, month, period, startDate } = filters;
  const stableFilters = useMemo(
    () => ({
      period,
      ...(endDate ? { endDate } : {}),
      ...(month ? { month } : {}),
      ...(startDate ? { startDate } : {}),
    }),
    [endDate, month, period, startDate],
  );
  const readFilteredReceipts = useCallback(
    () => factoryReceiptQueryService.filter(factoryReceiptDataSource.getReceipts(), stableFilters),
    [stableFilters],
  );
  const [receipts, setReceipts] = useState<FactoryReceipt[]>(() => readFilteredReceipts());
  const filterKey = JSON.stringify(stableFilters);
  const [loadedFilterKey, setLoadedFilterKey] = useState<string | null>(null);

  useEffect(() => {
    if (factoryReceiptDataSource.mode === 'firebase' && authStatus === 'loading') return;
    let active = true;
    void factoryReceiptDataSource.restore(user?.id, stableFilters).then(() => {
      if (active) {
        setReceipts(readFilteredReceipts());
        setLoadedFilterKey(filterKey);
      }
    });
    return () => {
      active = false;
    };
  }, [authStatus, filterKey, readFilteredReceipts, stableFilters, user?.id]);

  const refresh = useCallback(async () => {
    await factoryReceiptDataSource.restore(user?.id, stableFilters);
    setReceipts(readFilteredReceipts());
  }, [readFilteredReceipts, stableFilters, user?.id]);

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
    loading:
      (factoryReceiptDataSource.mode === 'firebase' && authStatus === 'loading') ||
      loadedFilterKey !== filterKey,
  };
}
