import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/providers';
import { factoryReceiptQueryService } from '@/services/finance';
import type { FactoryFilters } from '@/types/data';
import {
  factoryReceiptDataSource,
  factoryReceiptToPurchase,
  factoryReceiptsToPurchases,
  type CreatePurchaseInput,
} from '@/services/factory-purchases';

export function useFactoryPurchases(filters: FactoryFilters = { period: 'all' }) {
  const { sessionVersion, status: authStatus, user } = useAuth();
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

  const [sourceVersion, setSourceVersion] = useState(0);

  useEffect(() => {
    return factoryReceiptDataSource.subscribe(() => {
      setSourceVersion((v) => v + 1);
    });
  }, []);

  const receipts = useMemo(
    () =>
      factoryReceiptQueryService.filter(
        factoryReceiptDataSource.getReceipts(user?.id, sessionVersion),
        stableFilters,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionVersion, stableFilters, sourceVersion, user?.id],
  );

  const filterKey = JSON.stringify(stableFilters);
  const [loadedFilterKey, setLoadedFilterKey] = useState<string | null>(null);

  useEffect(() => {
    if (factoryReceiptDataSource.mode === 'firebase' && authStatus === 'loading') return;
    let active = true;
    void factoryReceiptDataSource.restore(user?.id, stableFilters, sessionVersion).then(() => {
      if (active) {
        setLoadedFilterKey(filterKey);
      }
    });
    return () => {
      active = false;
    };
  }, [authStatus, filterKey, sessionVersion, stableFilters, user?.id]);

  const refresh = useCallback(async () => {
    await factoryReceiptDataSource.restore(user?.id, stableFilters, sessionVersion);
  }, [sessionVersion, stableFilters, user?.id]);

  const createPurchase = useCallback(async (input: CreatePurchaseInput) => {
    const receipt = await factoryReceiptDataSource.createReceipt({
      bucketUnitPrice: input.bucketUnitPrice,
      date: input.date,
      quantity: input.bucketQuantity,
    });
    return factoryReceiptToPurchase(receipt);
  }, []);

  const addPayment = useCallback(
    async (purchaseId: string, payment: { date: string; amount: number }) => {
      const receipt = await factoryReceiptDataSource.addPayment(purchaseId, payment);
      return factoryReceiptToPurchase(receipt);
    },
    [],
  );

  const deletePurchase = useCallback(async (purchaseId: string) => {
    await factoryReceiptDataSource.deleteReceipt(purchaseId);
  }, []);

  const removePayment = useCallback(async (purchaseId: string, paymentId: string) => {
    const receipt = await factoryReceiptDataSource.removePayment(purchaseId, paymentId);
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
    dataUnavailable: factoryReceiptDataSource.isDataUnavailable === true,
  };
}
