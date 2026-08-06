import type { Purchase, PurchasePayment } from '@/features/factory-purchases/types';
import { factoryPurchaseCalculationService } from './FactoryPurchaseCalculationService';
import { mockFactoryPurchaseStorage } from './MockFactoryPurchaseStorage';

export type CreatePurchaseInput = {
  date: string;
  bucketQuantity: number;
  bucketUnitPrice: number;
};

export interface FactoryPurchaseDataSource {
  getPurchases(): Purchase[];
  createPurchase(input: CreatePurchaseInput): Purchase;
  addPayment(purchaseId: string, payment: Omit<PurchasePayment, 'id'>): Purchase;
  deletePurchase(purchaseId: string): void;
}

const MOCK_PURCHASES: Purchase[] = [];

function clonePurchase(purchase: Purchase): Purchase {
  return { ...purchase, payments: purchase.payments.map((payment) => ({ ...payment })) };
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class MockFactoryPurchaseDataSource implements FactoryPurchaseDataSource {
  private purchases = MOCK_PURCHASES.map(clonePurchase);
  private hasLocalMutation = false;
  private hydrationPromise: Promise<void> | null = null;

  public restore(): Promise<void> {
    if (this.hydrationPromise) return this.hydrationPromise;

    this.hydrationPromise = mockFactoryPurchaseStorage.load().then((purchases) => {
      if (!this.hasLocalMutation) this.purchases = purchases;
    });
    return this.hydrationPromise;
  }

  public getPurchases(): Purchase[] {
    return this.purchases.map(clonePurchase);
  }

  public createPurchase(input: CreatePurchaseInput): Purchase {
    const purchase: Purchase = {
      id: createId('purchase'),
      date: input.date,
      bucketQuantity: Math.round(input.bucketQuantity),
      bucketUnitPrice: input.bucketUnitPrice,
      totalAmount: Number((input.bucketQuantity * input.bucketUnitPrice).toFixed(2)),
      payments: [],
    };
    this.purchases = [purchase, ...this.purchases];
    this.hasLocalMutation = true;
    void mockFactoryPurchaseStorage.save(this.purchases);
    return clonePurchase(purchase);
  }

  public addPayment(purchaseId: string, payment: Omit<PurchasePayment, 'id'>): Purchase {
    const purchase = this.purchases.find((item) => item.id === purchaseId);
    if (!purchase) throw new Error('Compra não encontrada.');

    const amount = factoryPurchaseCalculationService.assertPaymentWithinBalance(
      purchase,
      payment.amount,
    );
    const updatedPurchase = {
      ...purchase,
      payments: [...purchase.payments, { ...payment, amount, id: createId('payment') }],
    };
    this.purchases = this.purchases.map((item) =>
      item.id === purchaseId ? updatedPurchase : item,
    );
    this.hasLocalMutation = true;
    void mockFactoryPurchaseStorage.save(this.purchases);
    return clonePurchase(updatedPurchase);
  }

  public deletePurchase(purchaseId: string): void {
    this.purchases = this.purchases.filter((purchase) => purchase.id !== purchaseId);
    this.hasLocalMutation = true;
    void mockFactoryPurchaseStorage.save(this.purchases);
  }
}

export const mockFactoryPurchaseDataSource = new MockFactoryPurchaseDataSource();
