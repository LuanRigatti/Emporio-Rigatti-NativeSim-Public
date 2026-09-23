import type { RetailOrder, RetailPayment } from '@/types/data';
import { retailOrderDataSource, retailPaymentDataSource } from '@/services/retail-orders';

export type RetailFinanceDataset = {
  orders: readonly RetailOrder[];
  ordersSignature: string;
  paymentsByOrderId: ReadonlyMap<string, readonly RetailPayment[]>;
};

export type RetailFinanceDatasetState = {
  dataset: RetailFinanceDataset | null;
  error?: string;
  loading: boolean;
  refreshing: boolean;
};

const EMPTY_STATE: RetailFinanceDatasetState = {
  dataset: null,
  loading: false,
  refreshing: false,
};

type ScopeState = {
  key: string;
  userId: string;
  sessionVersion?: number;
  requestGeneration: number;
  state: RetailFinanceDatasetState;
  inFlight?: Promise<void>;
};

function scopeKey(userId: string, sessionVersion?: number): string {
  return `${userId}:${sessionVersion ?? 'none'}`;
}

function ordersSignature(orders: readonly RetailOrder[]): string {
  return orders
    .map((order) =>
      JSON.stringify({
        clientId: order.clientId,
        clientNameSnapshot: order.clientNameSnapshot,
        deliveryAddressSnapshot: order.deliveryAddressSnapshot,
        deliveryCost: order.deliveryCost,
        deliveryDate: order.deliveryDate,
        deliveryFee: order.deliveryFee,
        discount: order.discount,
        lineItems: order.lineItems,
        occasion: order.occasion,
        orderDate: order.orderDate,
        orderId: order.orderId,
        recipient: order.recipient,
        status: order.status,
        totalCharged: order.totalCharged,
      }),
    )
    .sort()
    .join('::');
}

async function loadPaymentSnapshots(
  orders: readonly RetailOrder[],
  userId: string,
  sessionVersion: number | undefined,
  remote: boolean,
): Promise<ReadonlyMap<string, readonly RetailPayment[]>> {
  const next = new Map<string, readonly RetailPayment[]>();
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < orders.length) {
      const order = orders[nextIndex];
      nextIndex += 1;
      if (!order) continue;
      if (remote) {
        await retailPaymentDataSource.load(order.orderId, userId, sessionVersion);
      } else {
        await retailPaymentDataSource.hydrateFromCache(order.orderId, userId, sessionVersion);
      }
      next.set(order.orderId, retailPaymentDataSource.list(order.orderId, userId, sessionVersion));
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(2, Math.max(1, orders.length)) }, () => worker()),
  );
  return next;
}

function datasetFor(
  orders: readonly RetailOrder[],
  paymentsByOrderId: ReadonlyMap<string, readonly RetailPayment[]>,
): RetailFinanceDataset {
  return {
    orders,
    ordersSignature: ordersSignature(orders),
    paymentsByOrderId,
  };
}

export class RetailFinanceDatasetService {
  private readonly scopes = new Map<string, ScopeState>();
  private readonly listeners = new Set<() => void>();

  public constructor() {
    retailOrderDataSource.subscribe(() => this.syncOrderSnapshots());
    retailPaymentDataSource.subscribe(() => this.syncPaymentSnapshots());
  }

  public getSnapshot = (userId?: string, sessionVersion?: number): RetailFinanceDatasetState => {
    if (!userId) return EMPTY_STATE;
    return this.scopeFor(userId, sessionVersion).state;
  };

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public async load(userId: string, sessionVersion?: number, force = false): Promise<void> {
    const scope = this.scopeFor(userId, sessionVersion);
    if (scope.inFlight) return scope.inFlight;
    if (!force && scope.state.dataset) return;

    const generation = ++scope.requestGeneration;
    const hasDataset = Boolean(scope.state.dataset);
    scope.state = {
      dataset: scope.state.dataset,
      error: undefined,
      loading: !hasDataset,
      refreshing: hasDataset,
    };
    this.publish();

    const operation = this.loadScope(scope, userId, sessionVersion, generation, !hasDataset);
    scope.inFlight = operation;
    try {
      await operation;
    } finally {
      if (scope.inFlight === operation) scope.inFlight = undefined;
    }
  }

  public reload(userId: string, sessionVersion?: number): Promise<void> {
    return this.load(userId, sessionVersion, true);
  }

  private async loadScope(
    scope: ScopeState,
    userId: string,
    sessionVersion: number | undefined,
    generation: number,
    hydrateCache: boolean,
  ): Promise<void> {
    try {
      if (hydrateCache) {
        await retailOrderDataSource.hydrateFromCache(userId, sessionVersion);
        if (!this.isCurrent(scope, generation)) return;

        const cachedOrders = retailOrderDataSource.list(
          { includeCancelled: true },
          userId,
          sessionVersion,
        );
        if (cachedOrders.length) {
          const cachedDataset = datasetFor(
            cachedOrders,
            await loadPaymentSnapshots(cachedOrders, userId, sessionVersion, false),
          );
          if (!this.isCurrent(scope, generation)) return;
          scope.state = {
            dataset: cachedDataset,
            loading: false,
            refreshing: true,
          };
          this.publish();
        }
      }

      await retailOrderDataSource.loadHistorical(userId, sessionVersion);
      if (!this.isCurrent(scope, generation)) return;
      const orders = retailOrderDataSource.list({ includeCancelled: true }, userId, sessionVersion);
      const dataset = datasetFor(
        orders,
        await loadPaymentSnapshots(orders, userId, sessionVersion, true),
      );
      if (!this.isCurrent(scope, generation)) return;
      scope.state = {
        dataset,
        loading: false,
        refreshing: false,
      };
      this.publish();
    } catch (error) {
      if (!this.isCurrent(scope, generation)) return;
      scope.state = {
        ...scope.state,
        error: error instanceof Error ? error.message : 'Não foi possível carregar dados Varejo.',
        loading: false,
        refreshing: false,
      };
      this.publish();
      throw error;
    }
  }

  private scopeFor(userId: string, sessionVersion?: number): ScopeState {
    const key = scopeKey(userId, sessionVersion);
    const existing = this.scopes.get(key);
    if (existing) return existing;
    const scope: ScopeState = {
      key,
      userId,
      sessionVersion,
      requestGeneration: 0,
      state: EMPTY_STATE,
    };
    this.scopes.set(key, scope);
    return scope;
  }

  private isCurrent(scope: ScopeState, generation: number): boolean {
    return scope.requestGeneration === generation;
  }

  private syncOrderSnapshots(): void {
    let changed = false;
    this.scopes.forEach((scope) => {
      const dataset = scope.state.dataset;
      const snapshot = retailOrderDataSource.getSnapshot(scope.userId, scope.sessionVersion);
      if (!dataset || snapshot === null) return;
      const orders = retailOrderDataSource.list(
        { includeCancelled: true },
        scope.userId,
        scope.sessionVersion,
      );
      const signature = ordersSignature(orders);
      const orderIds = new Set(orders.map((order) => order.orderId));
      const paymentsByOrderId = new Map(
        [...dataset.paymentsByOrderId].filter(([orderId]) => orderIds.has(orderId)),
      );
      const orderWasRemoved = dataset.orders.some((order) => !orderIds.has(order.orderId));
      const paymentsWerePruned = paymentsByOrderId.size !== dataset.paymentsByOrderId.size;
      if (signature === dataset.ordersSignature && !paymentsWerePruned) return;
      if (orderWasRemoved) {
        scope.requestGeneration += 1;
        scope.inFlight = undefined;
      }
      scope.state = {
        ...scope.state,
        dataset: { ...dataset, orders, ordersSignature: signature, paymentsByOrderId },
        ...(orderWasRemoved ? { loading: false, refreshing: false } : {}),
      };
      changed = true;
    });
    if (changed) this.publish();
  }

  private syncPaymentSnapshots(): void {
    let changed = false;
    this.scopes.forEach((scope) => {
      const dataset = scope.state.dataset;
      if (!dataset) return;
      const paymentsByOrderId = new Map(dataset.paymentsByOrderId);
      let scopeChanged = false;
      dataset.orders.forEach((order) => {
        const snapshot = retailPaymentDataSource.getSnapshot(
          order.orderId,
          scope.userId,
          scope.sessionVersion,
        );
        if (snapshot !== null && paymentsByOrderId.get(order.orderId) !== snapshot) {
          paymentsByOrderId.set(order.orderId, snapshot);
          scopeChanged = true;
        }
      });
      if (!scopeChanged) return;
      scope.state = {
        ...scope.state,
        dataset: { ...dataset, paymentsByOrderId },
      };
      changed = true;
    });
    if (changed) this.publish();
  }

  private publish(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const retailFinanceDatasetService = new RetailFinanceDatasetService();
