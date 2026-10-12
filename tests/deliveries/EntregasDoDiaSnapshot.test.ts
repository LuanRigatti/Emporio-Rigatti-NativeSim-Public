import {
  createEntregasDoDiaTimeline,
  projectEntregasDoDiaSnapshot,
  unavailableEntregasDoDiaWidgetProps,
} from '@/features/deliveries/widgets/EntregasDoDiaSnapshot';
import type { CompleteDeliveryDateSnapshot } from '@/services/deliveries/FirestoreDeliveryDataSource';

function delivery(
  id: string,
  cliente: string,
  data: string,
  quantidade: number,
  valor: number,
  entregue = false,
): CompleteDeliveryDateSnapshot['deliveries'][number] {
  return {
    id,
    cliente,
    data,
    quantidade,
    valor,
    status: 'Não Pago',
    entregue,
  };
}

function expectPropertyListValue(value: unknown): void {
  if (value === null || value === undefined) {
    throw new Error('Widget props must not contain null or undefined.');
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(expectPropertyListValue);
    return;
  }
  if (typeof value === 'object') {
    Object.values(value).forEach(expectPropertyListValue);
    return;
  }
  throw new Error(`Unsupported widget prop type: ${typeof value}`);
}

describe('EntregasDoDia snapshot', () => {
  it('projects only the selected date with canonical ordering and existing delivery values', () => {
    const snapshot: CompleteDeliveryDateSnapshot = {
      uid: 'user-a',
      date: '2026-10-15',
      completedAt: 1,
      deliveries: [
        delivery('late', 'Cliente Z', '2026-10-15', 2, 60, true),
        delivery('other-day', 'Outro Dia', '2026-10-14', 10, 300),
        delivery('early', 'Cliente A', '2026-10-15', 1, 30),
      ],
    };

    const projected = projectEntregasDoDiaSnapshot(snapshot, 'pareact://historico?mode=wholesale');

    expect(projected).toMatchObject({
      date: '2026-10-15',
      availability: 'available',
      deliveryCount: 2,
      deliveryRouteURL: 'pareact://historico?mode=wholesale',
      deliveries: [
        { clientName: 'Cliente A', quantityLabel: '1 balde' },
        { clientName: 'Cliente Z', quantityLabel: '2 baldes' },
      ],
    });
    expect(projected.deliveries[0]?.valueLabel).toBe('R$ 30,00');
    expect(projected.deliveries[1]?.valueLabel).toBe('R$ 60,00');
  });

  it('distinguishes a complete empty day from data that is unavailable', () => {
    const completeEmpty = projectEntregasDoDiaSnapshot({
      uid: 'user-a',
      date: '2026-10-15',
      completedAt: 1,
      deliveries: [],
    });
    const unavailable = unavailableEntregasDoDiaWidgetProps('2026-10-15');

    expect(completeEmpty).toMatchObject({
      availability: 'available',
      deliveryCount: 0,
      deliveries: [],
    });
    expect(unavailable).toMatchObject({
      availability: 'unavailable',
      deliveryCount: 0,
      deliveries: [],
    });
    expect(completeEmpty.availability).not.toBe(unavailable.availability);
  });

  it('keeps two timeline entries, rollover date, and property-list-safe props', () => {
    const current = projectEntregasDoDiaSnapshot(
      {
        uid: 'user-a',
        date: '2026-10-15',
        completedAt: 1,
        deliveries: [delivery('one', 'Cliente A', '2026-10-15', 1, 30)],
      },
      'pareact://historico?mode=wholesale',
    );
    const timeline = createEntregasDoDiaTimeline(
      current,
      new Date(2026, 9, 15, 12),
      'pareact://historico?mode=wholesale',
    );

    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.date).toEqual(new Date(2026, 9, 15, 12));
    expect(timeline[1]?.date).toEqual(new Date(2026, 9, 16));
    expect(timeline[0]?.props).toMatchObject({ date: '2026-10-15', availability: 'available' });
    expect(timeline[1]?.props).toMatchObject({ date: '2026-10-16', availability: 'unavailable' });
    for (const entry of timeline) expectPropertyListValue(entry.props);
  });
});
