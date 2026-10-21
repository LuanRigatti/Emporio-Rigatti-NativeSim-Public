import type { WidgetTimelineEntry } from 'expo-widgets';

import type { CompleteDeliveryDateSnapshot } from '@/services/deliveries/FirestoreDeliveryDataSource';
import { deliveryQueryService } from '@/services/deliveries/DeliveryQueryService';
import {
  nextLocalMidnight,
  projectWholesaleDeliverySnapshot,
} from '@/features/deliveries/liveActivity/LiveActivityProjection';
import { formatClientName, formatCurrency, todayIso } from '@/utils/data';

export type EntregasDoDiaWidgetRow = {
  id: string;
  clientName: string;
  quantityLabel: string;
  activityBucketCount?: number;
  valueLabel: string;
  completionURL?: string;
  completionState?: 'pending' | 'failed';
  completionActionId?: string;
};

export type EntregasDoDiaWidgetState = 'pending' | 'all_completed' | 'empty' | 'unavailable';

export type EntregasDoDiaWidgetProps = {
  date: string;
  state: EntregasDoDiaWidgetState;
  deliveryCount: number;
  /** Optional to preserve timelines created before daily progress was added. */
  completedDeliveryCount?: number;
  totalDeliveryCount?: number;
  deliveries: EntregasDoDiaWidgetRow[];
  completedDeliveryIds?: string[];
  deliveryRouteURL?: string;
  actionSessionId?: string;
  actionRevision?: number;
};

export type EntregasDoDiaWidgetTimelineProps = Omit<
  EntregasDoDiaWidgetProps,
  'deliveryRouteURL'
> & {
  deliveryRouteURL?: string;
};

export function unavailableEntregasDoDiaWidgetProps(
  date: string,
  deliveryRouteURL?: string,
): EntregasDoDiaWidgetProps {
  return {
    date,
    state: 'unavailable',
    deliveryCount: 0,
    completedDeliveryCount: 0,
    totalDeliveryCount: 0,
    deliveries: [],
    ...(deliveryRouteURL ? { deliveryRouteURL } : {}),
  };
}

function compareWidgetDeliveryOrder(
  left: CompleteDeliveryDateSnapshot['deliveries'][number],
  right: CompleteDeliveryDateSnapshot['deliveries'][number],
): number {
  const leftOrderTimestamp =
    typeof left.dateAddedAt === 'number' && Number.isFinite(left.dateAddedAt)
      ? left.dateAddedAt
      : typeof left.createdAt === 'number' && Number.isFinite(left.createdAt)
        ? left.createdAt
        : undefined;
  const rightOrderTimestamp =
    typeof right.dateAddedAt === 'number' && Number.isFinite(right.dateAddedAt)
      ? right.dateAddedAt
      : typeof right.createdAt === 'number' && Number.isFinite(right.createdAt)
        ? right.createdAt
        : undefined;

  if (leftOrderTimestamp !== undefined && rightOrderTimestamp !== undefined) {
    return leftOrderTimestamp - rightOrderTimestamp || compareWidgetDeliveryIds(left.id, right.id);
  }
  if (leftOrderTimestamp !== undefined) return -1;
  if (rightOrderTimestamp !== undefined) return 1;
  return compareWidgetDeliveryIds(left.id, right.id);
}

function compareWidgetDeliveryIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function projectEntregasDoDiaSnapshot(
  snapshot: CompleteDeliveryDateSnapshot,
  deliveryRouteURL?: string,
  completionURLForDelivery?: (deliveryId: string, date: string) => string,
): EntregasDoDiaWidgetProps {
  if (snapshot.deliveries.some((delivery) => typeof delivery.entregue !== 'boolean')) {
    throw new Error('O snapshot de entregas do dia está incompleto.');
  }
  const dayDeliveries = deliveryQueryService.filter([...snapshot.deliveries], {
    mode: 'today',
    date: snapshot.date,
  });
  const pendingDeliveries = dayDeliveries
    .filter((delivery) => delivery.entregue === false)
    .sort(compareWidgetDeliveryOrder);
  const canonicalSummary = projectWholesaleDeliverySnapshot({
    ...snapshot,
    deliveries: dayDeliveries,
  });
  const state: EntregasDoDiaWidgetState =
    pendingDeliveries.length > 0 ? 'pending' : dayDeliveries.length > 0 ? 'all_completed' : 'empty';

  return {
    date: snapshot.date,
    state,
    deliveryCount: canonicalSummary.deliveryCount,
    completedDeliveryCount: canonicalSummary.completedDeliveryCount,
    totalDeliveryCount: canonicalSummary.totalDeliveryCount,
    deliveries: pendingDeliveries.map((delivery) => {
      const quantity = Number.isFinite(delivery.quantidade)
        ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(delivery.quantidade)
        : '—';

      return {
        id: delivery.id,
        clientName: formatClientName(delivery.cliente),
        quantityLabel: `${quantity} ${delivery.quantidade === 1 ? 'balde' : 'baldes'}`,
        activityBucketCount: projectWholesaleDeliverySnapshot({
          ...snapshot,
          deliveries: [delivery],
        }).bucketCount,
        valueLabel: Number.isFinite(delivery.valor) ? formatCurrency(delivery.valor) : '—',
        ...(completionURLForDelivery
          ? { completionURL: completionURLForDelivery(delivery.id, snapshot.date) }
          : {}),
      };
    }),
    ...(deliveryRouteURL ? { deliveryRouteURL } : {}),
  };
}

export function createEntregasDoDiaTimeline(
  current: EntregasDoDiaWidgetProps,
  now: Date,
  deliveryRouteURL?: string,
): WidgetTimelineEntry<EntregasDoDiaWidgetTimelineProps>[] {
  const nextDate = todayIso(nextLocalMidnight(current.date));
  const currentProps: EntregasDoDiaWidgetTimelineProps = {
    date: current.date,
    state: current.state,
    deliveryCount: current.deliveryCount,
    ...(current.completedDeliveryCount === undefined
      ? {}
      : { completedDeliveryCount: current.completedDeliveryCount }),
    ...(current.totalDeliveryCount === undefined
      ? {}
      : { totalDeliveryCount: current.totalDeliveryCount }),
    deliveries: current.deliveries,
    ...(deliveryRouteURL ? { deliveryRouteURL } : {}),
    ...(current.actionSessionId ? { actionSessionId: current.actionSessionId } : {}),
    ...(current.actionRevision !== undefined ? { actionRevision: current.actionRevision } : {}),
  };
  const nextProps = unavailableEntregasDoDiaWidgetProps(nextDate, deliveryRouteURL);

  return [
    { date: now, props: currentProps },
    {
      date: nextLocalMidnight(current.date),
      props: {
        date: nextProps.date,
        state: nextProps.state,
        deliveryCount: nextProps.deliveryCount,
        completedDeliveryCount: nextProps.completedDeliveryCount,
        totalDeliveryCount: nextProps.totalDeliveryCount,
        deliveries: nextProps.deliveries,
        ...(nextProps.deliveryRouteURL ? { deliveryRouteURL: nextProps.deliveryRouteURL } : {}),
      },
    },
  ];
}
