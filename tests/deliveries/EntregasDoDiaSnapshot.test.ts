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
  createdAt?: number,
  dateAddedAt?: number,
): CompleteDeliveryDateSnapshot['deliveries'][number] {
  return {
    ...(dateAddedAt === undefined ? {} : { dateAddedAt }),
    id,
    ...(createdAt === undefined ? {} : { createdAt }),
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
  it('projects only pending deliveries in canonical order with stable IDs and exact row links', () => {
    const snapshot: CompleteDeliveryDateSnapshot = {
      uid: 'user-a',
      date: '2026-10-15',
      completedAt: 1,
      deliveries: [
        delivery('late', 'Cliente A', '2026-10-15', 2, 60, false, 2_000),
        delivery('done', 'Cliente B', '2026-10-15', 3, 90, true, 500),
        delivery('other-day', 'Outro Dia', '2026-10-14', 10, 300),
        delivery('early', 'Cliente Z', '2026-10-15', 1, 30, false, 1_000),
      ],
    };

    const projected = projectEntregasDoDiaSnapshot(
      snapshot,
      'pareact://historico?mode=wholesale',
      (id, date) => `pareact://historico/entrega/${id}?date=${date}`,
    );

    expect(projected).toMatchObject({
      date: '2026-10-15',
      state: 'pending',
      deliveryCount: 2,
      deliveryRouteURL: 'pareact://historico?mode=wholesale',
      deliveries: [
        {
          id: 'early',
          clientName: 'Cliente Z',
          quantityLabel: '1 balde',
          completionURL: 'pareact://historico/entrega/early?date=2026-10-15',
        },
        {
          id: 'late',
          clientName: 'Cliente A',
          quantityLabel: '2 baldes',
          completionURL: 'pareact://historico/entrega/late?date=2026-10-15',
        },
      ],
    });
    expect(projected.deliveries[0]?.valueLabel).toBe('R$ 30,00');
    expect(projected.deliveries[1]?.valueLabel).toBe('R$ 60,00');
    expect(projected.deliveries.some(({ id }) => id === 'done')).toBe(false);
  });

  it('sorts by date-added time, falling back to creation time and stable IDs', () => {
    const projected = projectEntregasDoDiaSnapshot({
      uid: 'user-a',
      date: '2026-10-15',
      completedAt: 1,
      deliveries: [
        delivery('legacy-tie-b', 'Cliente A', '2026-10-15', 1, 30, false, 100),
        delivery('unknown-b', 'Cliente A', '2026-10-15', 1, 30),
        delivery('legacy-tie-a', 'Cliente Z', '2026-10-15', 1, 30, false, 100),
        delivery('legacy-first', 'Cliente Z', '2026-10-15', 1, 30, false, 50),
        delivery('added-late', 'Cliente Z', '2026-10-15', 1, 30, false, 1, 200),
        delivery('added-early', 'Cliente Z', '2026-10-15', 1, 30, false, 900, 100),
        delivery('unknown-a', 'Cliente Z', '2026-10-15', 1, 30),
      ],
    });

    expect(projected.deliveries.map(({ id }) => id)).toEqual([
      'legacy-first',
      'added-early',
      'legacy-tie-a',
      'legacy-tie-b',
      'added-late',
      'unknown-a',
      'unknown-b',
    ]);
  });

  it('distinguishes pending, all-completed, truly empty, and unavailable days', () => {
    const pending = projectEntregasDoDiaSnapshot({
      uid: 'user-a',
      date: '2026-10-15',
      completedAt: 1,
      deliveries: [delivery('pending', 'Cliente A', '2026-10-15', 1, 30)],
    });
    const allCompleted = projectEntregasDoDiaSnapshot({
      uid: 'user-a',
      date: '2026-10-15',
      completedAt: 1,
      deliveries: [delivery('done', 'Cliente A', '2026-10-15', 1, 30, true)],
    });
    const empty = projectEntregasDoDiaSnapshot({
      uid: 'user-a',
      date: '2026-10-15',
      completedAt: 1,
      deliveries: [],
    });
    const unavailable = unavailableEntregasDoDiaWidgetProps('2026-10-15');

    expect(pending.state).toBe('pending');
    expect(allCompleted).toMatchObject({
      state: 'all_completed',
      deliveryCount: 0,
      deliveries: [],
    });
    expect(empty).toMatchObject({ state: 'empty', deliveryCount: 0, deliveries: [] });
    expect(unavailable).toMatchObject({ state: 'unavailable', deliveryCount: 0, deliveries: [] });
    expect(new Set([pending.state, allCompleted.state, empty.state, unavailable.state]).size).toBe(
      4,
    );
  });

  it('does not classify a malformed delivery snapshot as all-completed', () => {
    const malformed = {
      uid: 'user-a',
      date: '2026-10-15',
      completedAt: 1,
      deliveries: [
        { ...delivery('unknown', 'Cliente A', '2026-10-15', 1, 30), entregue: undefined },
      ],
    } as unknown as CompleteDeliveryDateSnapshot;

    expect(() => projectEntregasDoDiaSnapshot(malformed)).toThrow(
      'O snapshot de entregas do dia está incompleto.',
    );
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
      (id, date) => `pareact://historico/entrega/${id}?date=${date}`,
    );
    const timeline = createEntregasDoDiaTimeline(
      current,
      new Date(2026, 9, 15, 12),
      'pareact://historico?mode=wholesale',
    );

    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.date).toEqual(new Date(2026, 9, 15, 12));
    expect(timeline[1]?.date).toEqual(new Date(2026, 9, 16));
    expect(timeline[0]?.props).toMatchObject({ date: '2026-10-15', state: 'pending' });
    expect(timeline[0]?.props.deliveries[0]?.completionURL).toBe(
      'pareact://historico/entrega/one?date=2026-10-15',
    );
    expect(timeline[1]?.props).toMatchObject({ date: '2026-10-16', state: 'unavailable' });
    for (const entry of timeline) expectPropertyListValue(entry.props);
  });
});
