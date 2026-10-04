import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/providers';
import { factoryReceiptQueryService } from '@/services/finance';
import type { FactoryFilters } from '@/types/data';
import {
  factoryReceiptDataSource,
  factoryReceiptToPurchase,
  factoryReceiptsToPurchases,
  type CreatePurchaseInput,
} from '@/services/factory-purchases';

const factoryPurchaseSourceListeners = new Set<() => void>();
let factoryPurchaseSourceVersion = 0;
let unsubscribeFactoryPurchaseSource: (() => void) | undefined;

function subscribeToFactoryPurchaseSource(onChange: () => void): () => void {
  factoryPurchaseSourceListeners.add(onChange);

  if (!unsubscribeFactoryPurchaseSource) {
    unsubscribeFactoryPurchaseSource = factoryReceiptDataSource.subscribe(() => {
      factoryPurchaseSourceVersion += 1;
      factoryPurchaseSourceListeners.forEach((listener) => listener());
    });
  }

  return () => {
    factoryPurchaseSourceListeners.delete(onChange);
    if (factoryPurchaseSourceListeners.size === 0) {
      unsubscribeFactoryPurchaseSource?.();
      unsubscribeFactoryPurchaseSource = undefined;
    }
  };
}

function getFactoryPurchaseSourceVersion(): number {
  return factoryPurchaseSourceVersion;
}

function useFactoryPurchaseSourceVersion(): number {
  return useSyncExternalStore(
    subscribeToFactoryPurchaseSource,
    getFactoryPurchaseSourceVersion,
    getFactoryPurchaseSourceVersion,
  );
}

export function useAddFactoryPurchasePayment() {
  return useCallback(async (purchaseId: string, payment: { date: string; amount: number }) => {
    const receipt = await factoryReceiptDataSource.addPayment(purchaseId, payment);
    return factoryReceiptToPurchase(receipt);
  }, []);
}

export function useFactoryPurchases(filters: FactoryFilters = { period: 'all' }) {
  const addPayment = useAddFactoryPurchasePayment();
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

  const sourceVersion = useFactoryPurchaseSourceVersion();

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

export function useFactoryPurchaseById(purchaseId?: string) {
  const { sessionVersion, user } = useAuth();
  useFactoryPurchaseSourceVersion();

  if (!purchaseId) return null;

  const receipt = factoryReceiptDataSource
    .getReceipts(user?.id, sessionVersion)
    .find((item) => item.id === purchaseId);

  return receipt ? factoryReceiptToPurchase(receipt) : null;
}
