import type { RetailOrder, RetailOrderFinancialSummary, RetailPayment } from '@/types/data';

import { calculateRetailOrderFinancials } from './RetailOrderCalculationService';
import { retailPaymentDataSource, type RetailPaymentDataSource } from './RetailPaymentDataSource';

export type RetailOrderHistoryFinancialState =
  { status: 'ready'; summary: RetailOrderFinancialSummary } | { status: 'error'; message: string };

export type RetailOrderHistoryFinancialLoadOptions = {
  onCachedSummary?: (
    orderId: string,
    summary: RetailOrderFinancialSummary,
    revalidating: boolean,
  ) => void;
  revalidate?: boolean;
};

type RetailPaymentReader = Pick<RetailPaymentDataSource, 'load' | 'list'> &
  Partial<Pick<RetailPaymentDataSource, 'getSnapshot' | 'hydrateFromCache'>>;

type CachedSummary = {
  signature: string;
  summary: RetailOrderFinancialSummary;
};

export class RetailOrderHistoryFinancialSummaryService {
  private readonly cache = new Map<string, CachedSummary>();
  private readonly orderEpochs = new Map<string, number>();
  private readonly listeners = new Set<() => void>();

  public constructor(
    private readonly paymentReader: RetailPaymentReader = retailPaymentDataSource,
  ) {}

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public clear(userId?: string, sessionVersion?: number): void {
    if (!userId) {
      this.cache.clear();
      return;
    }

    const prefix = this.sessionPrefix(userId, sessionVersion);
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }

  public invalidateOrder(orderId: string, userId: string, sessionVersion?: number): void {
    const epochKey = this.orderEpochKey(orderId, userId, sessionVersion);
    this.orderEpochs.set(epochKey, (this.orderEpochs.get(epochKey) ?? 0) + 1);
    const prefix = `${this.sessionPrefix(userId, sessionVersion)}${orderId}:`;
    let changed = false;
    for (const key of this.cache.keys()) {
      if (!key.startsWith(prefix)) continue;
      this.cache.delete(key);
      changed = true;
    }
    if (changed) this.listeners.forEach((listener) => listener());
  }

  public getCachedSummary(
    order: RetailOrder,
    userId: string,
    sessionVersion?: number,
  ): RetailOrderFinancialSummary | undefined {
    const cached = this.cache.get(this.cacheKey(order, userId, sessionVersion));
    return cached?.signature === getRetailOrderHistoryFinancialSignature(order)
      ? cached.summary
      : undefined;
  }

  public async loadForOrder(
    order: RetailOrder,
    userId: string,
    sessionVersion?: number,
    options: RetailOrderHistoryFinancialLoadOptions = {},
  ): Promise<RetailOrderFinancialSummary> {
    const key = this.cacheKey(order, userId, sessionVersion);
    const orderEpoch = this.getOrderEpoch(order.orderId, userId, sessionVersion);
    const cached = this.cache.get(key);
    const summaryMemory =
      cached?.signature === getRetailOrderHistoryFinancialSignature(order) ? 'hit' : 'miss';

    if (!options.revalidate && cached && summaryMemory === 'hit') {
      options.onCachedSummary?.(order.orderId, cached.summary, false);
      return cached.summary;
    }

    if (!options.revalidate && this.paymentReader.hydrateFromCache) {
      const cacheHydrated = await this.paymentReader.hydrateFromCache(
        order.orderId,
        userId,
        sessionVersion,
      );
      if (cacheHydrated) {
        this.assertOrderCurrent(order.orderId, userId, sessionVersion, orderEpoch);
        const cachedPayments = this.paymentReader.list(order.orderId, userId, sessionVersion);
        const cachedSummary = calculateRetailOrderFinancials({
          order,
          payments: cachedPayments,
        });
        options.onCachedSummary?.(order.orderId, cachedSummary, true);
      }
    }

    await this.paymentReader.load(order.orderId, userId, sessionVersion);
    this.assertOrderCurrent(order.orderId, userId, sessionVersion, orderEpoch);
    const remotePaymentSnapshot = this.paymentReader.list(order.orderId, userId, sessionVersion);
    const summary = calculateRetailOrderFinancials({
      order,
      payments: remotePaymentSnapshot,
    });
    this.cache.set(key, {
      signature: getRetailOrderHistoryFinancialSignature(order),
      summary,
    });
    return summary;
  }

  public updateForOrder(
    order: RetailOrder,
    payments: readonly RetailPayment[],
    userId: string,
    sessionVersion?: number,
  ): RetailOrderFinancialSummary | undefined {
    if (!this.isOrderCurrent(order.orderId, userId, sessionVersion)) return undefined;
    const currentPayments = this.paymentReader.getSnapshot?.(order.orderId, userId, sessionVersion);
    if (this.paymentReader.getSnapshot && currentPayments === null) return undefined;

    const summary = calculateRetailOrderFinancials({
      order,
      payments: currentPayments ?? payments,
    });
    this.cache.set(this.cacheKey(order, userId, sessionVersion), {
      signature: getRetailOrderHistoryFinancialSignature(order),
      summary,
    });
    this.listeners.forEach((listener) => listener());
    return summary;
  }

  public async primeFromCache(
    orders: readonly RetailOrder[],
    userId: string,
    sessionVersion?: number,
  ): Promise<void> {
    const uniqueOrders = [...new Map(orders.map((order) => [order.orderId, order])).values()];
    const hydrateFromCache = this.paymentReader.hydrateFromCache?.bind(this.paymentReader);

    if (!uniqueOrders.length || !hydrateFromCache) {
      return;
    }

    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < uniqueOrders.length) {
        const order = uniqueOrders[nextIndex];
        nextIndex += 1;
        if (!order) continue;

        const key = this.cacheKey(order, userId, sessionVersion);
        const signature = getRetailOrderHistoryFinancialSignature(order);
        const cached = this.cache.get(key);
        if (cached?.signature === signature) {
          continue;
        }

        let hydrated = false;
        const orderEpoch = this.getOrderEpoch(order.orderId, userId, sessionVersion);
        try {
          hydrated = await hydrateFromCache(order.orderId, userId, sessionVersion);
        } catch {
          continue;
        }

        if (!hydrated) {
          continue;
        }

        if (!this.isOrderCurrent(order.orderId, userId, sessionVersion, orderEpoch)) {
          continue;
        }

        const payments = this.paymentReader.list(order.orderId, userId, sessionVersion);
        const summary = calculateRetailOrderFinancials({ order, payments });
        this.cache.set(key, { signature, summary });
      }
    };

    await Promise.all(Array.from({ length: Math.min(2, uniqueOrders.length) }, () => worker()));
  }

  public async loadForOrders(
    orders: readonly RetailOrder[],
    userId: string,
    sessionVersion?: number,
    options: RetailOrderHistoryFinancialLoadOptions = {},
  ): Promise<ReadonlyMap<string, RetailOrderHistoryFinancialState>> {
    const results = new Map<string, RetailOrderHistoryFinancialState>();
    let nextIndex = 0;
    const workerCount = Math.min(2, orders.length);

    const worker = async () => {
      while (nextIndex < orders.length) {
        const order = orders[nextIndex];
        nextIndex += 1;
        if (!order) continue;

        try {
          const summary = await this.loadForOrder(order, userId, sessionVersion, options);
          results.set(order.orderId, { status: 'ready', summary });
        } catch (error) {
          results.set(order.orderId, {
            message:
              error instanceof Error
                ? error.message
                : 'Não foi possível carregar o resumo financeiro.',
            status: 'error',
          });
        }
      }
    };

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
  }

  private cacheKey(order: RetailOrder, userId: string, sessionVersion?: number): string {
    return `${this.sessionPrefix(userId, sessionVersion)}${order.orderId}:${getRetailOrderHistoryFinancialSignature(order)}`;
  }

  private sessionPrefix(userId: string, sessionVersion?: number): string {
    return `${userId}:${sessionVersion ?? 'none'}:`;
  }

  private orderEpochKey(orderId: string, userId: string, sessionVersion?: number): string {
    return `${this.sessionPrefix(userId, sessionVersion)}${orderId}`;
  }

  private getOrderEpoch(orderId: string, userId: string, sessionVersion?: number): number {
    return this.orderEpochs.get(this.orderEpochKey(orderId, userId, sessionVersion)) ?? 0;
  }

  private isOrderCurrent(
    orderId: string,
    userId: string,
    sessionVersion?: number,
    expectedEpoch = this.getOrderEpoch(orderId, userId, sessionVersion),
  ): boolean {
    return this.getOrderEpoch(orderId, userId, sessionVersion) === expectedEpoch;
  }

  private assertOrderCurrent(
    orderId: string,
    userId: string,
    sessionVersion: number | undefined,
    expectedEpoch: number,
  ): void {
    if (!this.isOrderCurrent(orderId, userId, sessionVersion, expectedEpoch)) {
      throw new Error('Resumo financeiro obsoleto.');
    }
  }
}

export function getRetailOrderHistoryFinancialSignature(order: RetailOrder): string {
  const lineItemsSignature = order.lineItems
    .map((lineItem) =>
      [
        lineItem.productId,
        lineItem.quantity,
        lineItem.unitSalePriceSnapshot,
        lineItem.lineSubtotal,
        lineItem.unitCostSnapshot,
        lineItem.lineCostTotal,
        lineItem.discountAllocatedSnapshot,
      ].join(':'),
    )
    .join(';');
  return [
    order.orderId,
    order.orderDate,
    order.subtotalProducts,
    order.discount,
    order.deliveryFee,
    order.deliveryCost,
    lineItemsSignature,
  ].join('|');
}

export const retailOrderHistoryFinancialSummaryService =
  new RetailOrderHistoryFinancialSummaryService();
