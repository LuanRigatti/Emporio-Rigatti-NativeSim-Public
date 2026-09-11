import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Purchase, PurchasePayment } from '@/features/factory-purchases/types';

export const MOCK_FACTORY_PURCHASES_STORAGE_KEY = '@pareact/mock-factory-purchases-v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPurchasePayment(value: unknown): value is PurchasePayment {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    typeof value.amount === 'number' &&
    Number.isFinite(value.amount)
  );
}

function isPurchase(value: unknown): value is Purchase {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    typeof value.bucketQuantity === 'number' &&
    Number.isFinite(value.bucketQuantity) &&
    typeof value.bucketUnitPrice === 'number' &&
    Number.isFinite(value.bucketUnitPrice) &&
    typeof value.totalAmount === 'number' &&
    Number.isFinite(value.totalAmount) &&
    Array.isArray(value.payments) &&
    value.payments.every(isPurchasePayment)
  );
}

function clonePurchase(purchase: Purchase): Purchase {
  return { ...purchase, payments: purchase.payments.map((payment) => ({ ...payment })) };
}

function parsePurchases(serialized: string | null): Purchase[] | null {
  if (!serialized) return null;

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed) || !parsed.every(isPurchase)) return null;
    return parsed.map(clonePurchase);
  } catch {
    return null;
  }
}

export class MockFactoryPurchaseStorage {
  private writeQueue = Promise.resolve();

  public async load(): Promise<Purchase[]> {
    try {
      return parsePurchases(await AsyncStorage.getItem(MOCK_FACTORY_PURCHASES_STORAGE_KEY)) ?? [];
    } catch (error) {
      if (__DEV__) console.warn('[MockFactoryPurchaseStorage] Falha ao ler compras mock.', error);
      return [];
    }
  }

  public save(purchases: readonly Purchase[]): Promise<void> {
    const serialized = JSON.stringify(purchases.map(clonePurchase));
    this.writeQueue = this.writeQueue
      .then(() => AsyncStorage.setItem(MOCK_FACTORY_PURCHASES_STORAGE_KEY, serialized))
      .catch((error) => {
        if (__DEV__) {
          console.warn('[MockFactoryPurchaseStorage] Falha ao salvar compras mock.', error);
        }
      });
    return this.writeQueue;
  }
}

export const mockFactoryPurchaseStorage = new MockFactoryPurchaseStorage();
