import type { Delivery } from '@/types/data';
import type { HistoryDelivery } from '@/features/history/data/historyMocks';

type ProjectionInputs = Pick<
  Delivery,
  | 'id'
  | 'cliente'
  | 'data'
  | 'metodoPagamento'
  | 'observacao'
  | 'quantidade'
  | 'entregue'
  | 'status'
  | 'valor'
>;

type CachedProjection = {
  inputs: ProjectionInputs;
  item: HistoryDelivery;
};

export type HistoryDeliveryProjection = {
  items: HistoryDelivery[];
  convertedCount: number;
  reusedCount: number;
  insertedCount: number;
  removedCount: number;
  orderChanged: boolean;
};

function projectionInputs(delivery: Delivery): ProjectionInputs {
  return {
    cliente: delivery.cliente,
    data: delivery.data,
    entregue: delivery.entregue,
    id: delivery.id,
    metodoPagamento: delivery.metodoPagamento,
    observacao: delivery.observacao,
    quantidade: delivery.quantidade,
    status: delivery.status,
    valor: delivery.valor,
  };
}

function inputsMatch(left: ProjectionInputs, right: ProjectionInputs): boolean {
  return (
    left.id === right.id &&
    left.cliente === right.cliente &&
    left.data === right.data &&
    left.metodoPagamento === right.metodoPagamento &&
    left.observacao === right.observacao &&
    Object.is(left.quantidade, right.quantidade) &&
    Object.is(left.entregue, right.entregue) &&
    left.status === right.status &&
    Object.is(left.valor, right.valor)
  );
}

function sameOrder(previous: readonly string[], next: readonly string[]): boolean {
  return previous.length === next.length && previous.every((id, index) => id === next[index]);
}

/** Reuses history rows only when every input consumed by toHistoryDelivery is unchanged. */
export function createHistoryDeliveryProjector(
  toHistoryDelivery: (delivery: Delivery) => HistoryDelivery,
  initialSessionScopeKey: string,
): (deliveries: readonly Delivery[], sessionScopeKey?: string) => HistoryDeliveryProjection {
  const cache = new Map<string, CachedProjection>();
  let previousOrder: string[] | null = null;
  let activeSessionScopeKey = initialSessionScopeKey;

  return (deliveries, requestedSessionScopeKey = activeSessionScopeKey) => {
    if (requestedSessionScopeKey !== activeSessionScopeKey) {
      cache.clear();
      previousOrder = null;
      activeSessionScopeKey = requestedSessionScopeKey;
    }
    const presentIds = new Set<string>();
    const nextOrder = deliveries.map(({ id }) => id);
    let convertedCount = 0;
    let reusedCount = 0;
    let insertedCount = 0;

    const items = deliveries.map((delivery) => {
      presentIds.add(delivery.id);
      const inputs = projectionInputs(delivery);
      const existing = cache.get(delivery.id);
      if (existing && inputsMatch(existing.inputs, inputs)) {
        reusedCount += 1;
        cache.set(delivery.id, { inputs, item: existing.item });
        return existing.item;
      }

      convertedCount += 1;
      if (!existing) insertedCount += 1;
      const item = toHistoryDelivery(delivery);
      cache.set(delivery.id, { inputs, item });
      return item;
    });

    let removedCount = 0;
    for (const id of cache.keys()) {
      if (!presentIds.has(id)) {
        cache.delete(id);
        removedCount += 1;
      }
    }

    const orderChanged = previousOrder !== null && !sameOrder(previousOrder, nextOrder);
    previousOrder = nextOrder;

    return { convertedCount, insertedCount, items, orderChanged, removedCount, reusedCount };
  };
}
