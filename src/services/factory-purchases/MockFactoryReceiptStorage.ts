import AsyncStorage from '@react-native-async-storage/async-storage';

import type { FactoryPayment, FactoryReceipt } from '@/types/data';

import { purchaseToFactoryReceipt } from './FactoryReceiptPurchaseAdapter';
import { mockFactoryPurchaseStorage } from './MockFactoryPurchaseStorage';

export const MOCK_FACTORY_RECEIPTS_STORAGE_KEY = '@pareact/mock-factory-receipts-v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFactoryPayment(value: unknown): value is FactoryPayment {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.data === 'string' &&
    typeof value.valor === 'number' &&
    Number.isFinite(value.valor)
  );
}

function isFactoryReceipt(value: unknown): value is FactoryReceipt {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.quantidade === 'number' &&
    Number.isFinite(value.quantidade) &&
    typeof value.data === 'string' &&
    typeof value.valorTotal === 'number' &&
    Number.isFinite(value.valorTotal) &&
    typeof value.concluido === 'boolean' &&
    Array.isArray(value.pagamentos) &&
    value.pagamentos.every(isFactoryPayment)
  );
}

function cloneReceipt(receipt: FactoryReceipt): FactoryReceipt {
  return {
    ...receipt,
    pagamentos: receipt.pagamentos.map((payment) => ({ ...payment })),
  };
}

function parseReceipts(serialized: string | null): FactoryReceipt[] | null {
  if (!serialized) return null;

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed) || !parsed.every(isFactoryReceipt)) return null;
    return parsed.map(cloneReceipt);
  } catch {
    return null;
  }
}

export class MockFactoryReceiptStorage {
  private writeQueue = Promise.resolve();

  public async load(): Promise<FactoryReceipt[]> {
    try {
      const serialized = await AsyncStorage.getItem(MOCK_FACTORY_RECEIPTS_STORAGE_KEY);
      const receipts = parseReceipts(serialized);
      if (receipts) return receipts;

      // Compatibility path for data created before the FactoryReceipt contract.
      return (await mockFactoryPurchaseStorage.load()).map(purchaseToFactoryReceipt);
    } catch (error) {
      if (__DEV__) console.warn('[MockFactoryReceiptStorage] Falha ao ler compras mock.', error);
      return [];
    }
  }

  public save(receipts: readonly FactoryReceipt[]): Promise<void> {
    const serialized = JSON.stringify(receipts.map(cloneReceipt));
    this.writeQueue = this.writeQueue
      .then(() => AsyncStorage.setItem(MOCK_FACTORY_RECEIPTS_STORAGE_KEY, serialized))
      .catch((error) => {
        if (__DEV__) {
          console.warn('[MockFactoryReceiptStorage] Falha ao salvar compras mock.', error);
        }
      });
    return this.writeQueue;
  }
}

export const mockFactoryReceiptStorage = new MockFactoryReceiptStorage();
