import type { WidgetTimelineEntry } from 'expo-widgets';

import type { CompleteDeliveryDateSnapshot } from '@/services/deliveries/FirestoreDeliveryDataSource';
import { deliveryQueryService } from '@/services/deliveries/DeliveryQueryService';
import {
  nextLocalMidnight,
  projectWholesaleDeliverySnapshot,
} from '@/features/deliveries/liveActivity/LiveActivityProjection';
import { formatClientName, formatCurrency, todayIso } from '@/utils/data';

export type EntregasDoDiaWidgetRow = {
  clientName: string;
  quantityLabel: string;
  valueLabel: string;
};

export type EntregasDoDiaWidgetProps = {
  date: string;
  availability: 'available' | 'unavailable';
  deliveryCount: number;
  deliveries: EntregasDoDiaWidgetRow[];
  deliveryRouteURL?: string;
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
    availability: 'unavailable',
    deliveryCount: 0,
    deliveries: [],
    ...(deliveryRouteURL ? { deliveryRouteURL } : {}),
  };
}

export function projectEntregasDoDiaSnapshot(
  snapshot: CompleteDeliveryDateSnapshot,
  deliveryRouteURL?: string,
): EntregasDoDiaWidgetProps {
  const deliveries = deliveryQueryService.filter([...snapshot.deliveries], {
    mode: 'today',
    date: snapshot.date,
  });
  const canonicalSummary = projectWholesaleDeliverySnapshot({
    ...snapshot,
    deliveries,
  });

  return {
    date: snapshot.date,
    availability: 'available',
    deliveryCount: canonicalSummary.deliveryCount,
    deliveries: deliveries.map((delivery) => {
      const quantity = Number.isFinite(delivery.quantidade)
        ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(delivery.quantidade)
        : '—';

      return {
        clientName: formatClientName(delivery.cliente),
        quantityLabel: `${quantity} ${delivery.quantidade === 1 ? 'balde' : 'baldes'}`,
        valueLabel: Number.isFinite(delivery.valor) ? formatCurrency(delivery.valor) : '—',
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
    availability: current.availability,
    deliveryCount: current.deliveryCount,
    deliveries: current.deliveries,
    ...(deliveryRouteURL ? { deliveryRouteURL } : {}),
  };
  const nextProps = unavailableEntregasDoDiaWidgetProps(nextDate, deliveryRouteURL);

  return [
    { date: now, props: currentProps },
    {
      date: nextLocalMidnight(current.date),
      props: {
        date: nextProps.date,
        availability: nextProps.availability,
        deliveryCount: nextProps.deliveryCount,
        deliveries: nextProps.deliveries,
        ...(nextProps.deliveryRouteURL ? { deliveryRouteURL: nextProps.deliveryRouteURL } : {}),
      },
    },
  ];
}
