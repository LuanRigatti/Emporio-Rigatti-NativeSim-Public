import { useCallback, useEffect, useMemo, useState } from 'react';

import type { FactoryReceipt } from '@/types/data';
import {
  factoryReceiptDataSource,
  factoryReceiptToPurchase,
  factoryReceiptsToPurchases,
  type CreatePurchaseInput,
} from '@/services/factory-purchases';

export function useFactoryPurchases() {
  const [receipts, setReceipts] = useState<FactoryReceipt[]>(() =>
    factoryReceiptDataSource.getReceipts(),
  );

  useEffect(() => {
    let active = true;
    void factoryReceiptDataSource.restore().then(() => {
      if (active) setReceipts(factoryReceiptDataSource.getReceipts());
    });
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(() => {
    setReceipts(factoryReceiptDataSource.getReceipts());
  }, []);

  const createPurchase = useCallback((input: CreatePurchaseInput) => {
    const receipt = factoryReceiptDataSource.createReceipt({
      bucketUnitPrice: input.bucketUnitPrice,
      date: input.date,
      quantity: input.bucketQuantity,
    });
    setReceipts(factoryReceiptDataSource.getReceipts());
    return factoryReceiptToPurchase(receipt);
  }, []);

  const addPayment = useCallback(
    (purchaseId: string, payment: { date: string; amount: number }) => {
      const receipt = factoryReceiptDataSource.addPayment(purchaseId, payment);
      setReceipts(factoryReceiptDataSource.getReceipts());
      return factoryReceiptToPurchase(receipt);
    },
    [],
  );

  const deletePurchase = useCallback((purchaseId: string) => {
    factoryReceiptDataSource.deleteReceipt(purchaseId);
    setReceipts(factoryReceiptDataSource.getReceipts());
  }, []);

  const removePayment = useCallback((purchaseId: string, paymentId: string) => {
    const receipt = factoryReceiptDataSource.removePayment(purchaseId, paymentId);
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
