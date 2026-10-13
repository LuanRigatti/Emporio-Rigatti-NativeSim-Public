import { EntregasDoDiaSnapshotCoordinator } from '@/features/deliveries/widgets/EntregasDoDiaSnapshotCoordinator';
import type {
  CompleteDeliveryDateSnapshot,
  DeliveryDateSnapshotEvent,
  FirestoreDeliveryDataSource,
} from '@/services/deliveries/FirestoreDeliveryDataSource';

jest.mock('@/services/deliveries/FirestoreDeliveryDataSource', () => ({
  firestoreDeliveryDataSource: {
    subscribeDateSnapshots: () => () => undefined,
    getCompleteDateSnapshot: () => null,
  },
}));

type SnapshotSource = Pick<
  FirestoreDeliveryDataSource,
  'subscribeDateSnapshots' | 'getCompleteDateSnapshot'
>;

async function flushWidgetDriver(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function makeSnapshot(uid: string): CompleteDeliveryDateSnapshot {
  return {
    uid,
    date: '2026-10-15',
    completedAt: 1,
    deliveries: [
      {
        id: 'delivery-1',
        cliente: 'Cliente A',
        data: '2026-10-15',
        quantidade: 1,
        valor: 30,
        status: 'Não Pago',
        entregue: false,
      },
    ],
  };
}

function makeHarness(initialSnapshot: CompleteDeliveryDateSnapshot | null = null) {
  let listener: ((event: DeliveryDateSnapshotEvent) => void) | null = null;
  let completeSnapshot = initialSnapshot;
  const source: SnapshotSource = {
    subscribeDateSnapshots: jest.fn((nextListener) => {
      listener = nextListener;
      return () => {
        listener = null;
      };
    }),
    getCompleteDateSnapshot: jest.fn((uid, date, sessionVersion) => {
      if (completeSnapshot?.uid !== uid || completeSnapshot.date !== date || sessionVersion !== 7) {
        return null;
      }
      return completeSnapshot;
    }),
  };
  const updateTimeline = jest.fn();
  const coordinator = new EntregasDoDiaSnapshotCoordinator({
    source,
    isIOS: true,
    now: () => new Date(2026, 9, 15, 12),
    routeURL: () => 'pareact://historico?mode=wholesale',
    deliveryURL: (id, date) => `pareact://historico/entrega/${id}?date=${date}`,
    loadWidget: async () => ({ updateTimeline }),
  });

  return {
    coordinator,
    source,
    updateTimeline,
    setCompleteSnapshot: (snapshot: CompleteDeliveryDateSnapshot | null) => {
      completeSnapshot = snapshot;
    },
    emit: (event: DeliveryDateSnapshotEvent) => listener?.(event),
  };
}

describe('EntregasDoDiaSnapshotCoordinator', () => {
  it('publishes an existing complete daily snapshot without issuing a new query', async () => {
    const { coordinator, source, updateTimeline } = makeHarness(makeSnapshot('user-a'));
    coordinator.setSession('user-a', 7);
    await flushWidgetDriver();

    expect(source.getCompleteDateSnapshot).toHaveBeenCalledWith('user-a', '2026-10-15', 7);
    expect(updateTimeline).toHaveBeenCalledTimes(1);
    expect(updateTimeline.mock.calls[0]?.[0][0]?.props).toMatchObject({
      state: 'pending',
      deliveryCount: 1,
      deliveryRouteURL: 'pareact://historico?mode=wholesale',
      deliveries: [
        {
          id: 'delivery-1',
          completionURL: 'pareact://historico/entrega/delivery-1?date=2026-10-15',
        },
      ],
    });
    coordinator.dispose();
  });

  it('keeps the widget unavailable until a full snapshot event arrives', async () => {
    const { coordinator, updateTimeline, setCompleteSnapshot, emit } = makeHarness();
    coordinator.setSession('user-a', 7);
    await flushWidgetDriver();

    expect(updateTimeline.mock.calls[0]?.[0][0]?.props).toMatchObject({
      state: 'unavailable',
      deliveries: [],
    });

    setCompleteSnapshot(makeSnapshot('user-a'));
    emit({ type: 'complete', snapshot: makeSnapshot('user-a') });

    expect(updateTimeline).toHaveBeenCalledTimes(2);
    expect(updateTimeline.mock.calls[1]?.[0][0]?.props).toMatchObject({
      state: 'pending',
      deliveries: [{ clientName: 'Cliente A' }],
    });
    coordinator.dispose();
  });

  it('publishes the next pending rows after the canonical cache confirms completion', async () => {
    const initial: CompleteDeliveryDateSnapshot = {
      uid: 'user-a',
      date: '2026-10-15',
      completedAt: 1,
      deliveries: [
        {
          id: 'delivery-a',
          cliente: 'Cliente A',
          data: '2026-10-15',
          quantidade: 1,
          valor: 30,
          status: 'Não Pago',
          entregue: false,
        },
        {
          id: 'delivery-b',
          cliente: 'Cliente B',
          data: '2026-10-15',
          quantidade: 2,
          valor: 60,
          status: 'Não Pago',
          entregue: false,
        },
        {
          id: 'delivery-c',
          cliente: 'Cliente C',
          data: '2026-10-15',
          quantidade: 3,
          valor: 90,
          status: 'Não Pago',
          entregue: false,
        },
      ],
    };
    const { coordinator, updateTimeline, setCompleteSnapshot } = makeHarness(initial);
    coordinator.setSession('user-a', 7);
    await flushWidgetDriver();

    setCompleteSnapshot({
      ...initial,
      deliveries: [{ ...initial.deliveries[0]!, entregue: true }, ...initial.deliveries.slice(1)],
    });
    coordinator.refreshAvailableSnapshot('user-a', 7);

    expect(updateTimeline).toHaveBeenCalledTimes(2);
    expect(updateTimeline.mock.calls[1]?.[0][0]?.props).toMatchObject({
      state: 'pending',
      deliveryCount: 2,
      deliveries: [{ id: 'delivery-b' }, { id: 'delivery-c' }],
    });
    coordinator.dispose();
  });

  it('invalidates on source invalidation and ignores events from a previous UID', async () => {
    const { coordinator, updateTimeline, setCompleteSnapshot, emit } = makeHarness(
      makeSnapshot('user-a'),
    );
    coordinator.setSession('user-a', 7);
    await flushWidgetDriver();
    expect(updateTimeline).toHaveBeenCalledTimes(1);

    setCompleteSnapshot(null);
    emit({ type: 'invalidated', uid: 'user-a', date: '2026-10-15' });
    expect(updateTimeline.mock.calls[1]?.[0][0]?.props).toMatchObject({
      state: 'unavailable',
    });

    coordinator.setSession('user-b', 8);
    await flushWidgetDriver();
    const callCountBeforeStaleEvent = updateTimeline.mock.calls.length;
    emit({ type: 'complete', snapshot: makeSnapshot('user-a') });
    expect(updateTimeline).toHaveBeenCalledTimes(callCountBeforeStaleEvent);
    expect(updateTimeline.mock.calls.at(-1)?.[0][0]?.props).toMatchObject({
      state: 'unavailable',
      deliveries: [],
    });
    coordinator.dispose();
  });
});
