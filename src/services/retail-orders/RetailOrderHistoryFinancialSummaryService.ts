import type { RetailOrder, RetailOrderFinancialSummary } from '@/types/data';

import { calculateRetailOrderFinancials } from './RetailOrderCalculationService';
import { retailPaymentDataSource, type RetailPaymentDataSource } from './RetailPaymentDataSource';

export type RetailOrderHistoryFinancialState =
  { status: 'ready'; summary: RetailOrderFinancialSummary } | { status: 'error'; message: string };

type CachedSummary = {
  signature: string;
  summary: RetailOrderFinancialSummary;
};

export class RetailOrderHistoryFinancialSummaryService {
  private readonly cache = new Map<string, CachedSummary>();

  public constructor(
    private readonly paymentReader: Pick<
      RetailPaymentDataSource,
      'load' | 'list'
    > = retailPaymentDataSource,
  ) {}

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

  public async loadForOrder(
    order: RetailOrder,
    userId: string,
    sessionVersion?: number,
  ): Promise<RetailOrderFinancialSummary> {
    const key = this.cacheKey(order, userId, sessionVersion);
    const cached = this.cache.get(key);
    if (cached?.signature === orderSignature(order)) return cached.summary;

    await this.paymentReader.load(order.orderId, userId, sessionVersion);
    const summary = calculateRetailOrderFinancials({
      order,
      payments: this.paymentReader.list(order.orderId, userId, sessionVersion),
    });
    this.cache.set(key, { signature: orderSignature(order), summary });
    return summary;
  }

  public async loadForOrders(
    orders: readonly RetailOrder[],
    userId: string,
    sessionVersion?: number,
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
          const summary = await this.loadForOrder(order, userId, sessionVersion);
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
    return `${this.sessionPrefix(userId, sessionVersion)}${order.orderId}:${orderSignature(order)}`;
  }

  private sessionPrefix(userId: string, sessionVersion?: number): string {
    return `${userId}:${sessionVersion ?? 'none'}:`;
  }
}

function orderSignature(order: RetailOrder): string {
  return [
    order.orderId,
    order.orderDate,
    order.status,
    order.subtotalProducts,
    order.discount,
    order.deliveryFee,
    order.deliveryCost,
  ].join('|');
}

export const retailOrderHistoryFinancialSummaryService =
  new RetailOrderHistoryFinancialSummaryService();
