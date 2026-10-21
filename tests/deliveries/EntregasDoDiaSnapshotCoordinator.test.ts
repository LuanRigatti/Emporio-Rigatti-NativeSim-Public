import { EntregasDoDiaSnapshotCoordinator } from '@/features/deliveries/widgets/EntregasDoDiaSnapshotCoordinator';
import type {
  CompleteDeliveryDateSnapshot,
  DeliveryDateSnapshotEvent,
  FirestoreDeliveryDataSource,
} from '@/services/deliveries/FirestoreDeliveryDataSource';

const mockRecordWidgetOperationalFailure = jest.fn();

jest.mock('@/utils/widgetOperationalErrors', () => ({
  recordWidgetOperationalFailure: (...args: unknown[]) =>
    mockRecordWidgetOperationalFailure(...args),
}));

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

function makeSnapshot(uid: string, date = '2026-10-15'): CompleteDeliveryDateSnapshot {
  return {
    uid,
    date,
    completedAt: 1,
    deliveries: [
      {
        id: 'delivery-1',
        cliente: 'Cliente A',
        data: date,
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
  let now = new Date(2026, 9, 15, 12);
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
    now: () => now,
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
    setDate: (date: Date) => {
      now = date;
    },
    emit: (event: DeliveryDateSnapshotEvent) => listener?.(event),
  };
}

describe('EntregasDoDiaSnapshotCoordinator', () => {
  beforeEach(() => {
    mockRecordWidgetOperationalFailure.mockClear();
  });

  it('publishes an existing complete daily snapshot without issuing a new query', async () => {
    const { coordinator, source, updateTimeline } = makeHarness(makeSnapshot('user-a'));
    coordinator.setSession('user-a', 7);
    await flushWidgetDriver();

    expect(source.getCompleteDateSnapshot).toHaveBeenCalledWith('user-a', '2026-10-15', 7);
    expect(updateTimeline).toHaveBeenCalledTimes(1);
    expect(mockRecordWidgetOperationalFailure).not.toHaveBeenCalled();
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

  it('keeps unavailable data published when a complete event has no canonical snapshot', async () => {
    const { coordinator, updateTimeline, emit } = makeHarness();
    coordinator.setSession('user-a', 7);
    await flushWidgetDriver();
    emit({ type: 'complete', snapshot: makeSnapshot('user-a') });

    expect(updateTimeline).toHaveBeenCalledTimes(1);
    expect(updateTimeline.mock.calls[0]?.[0][0]?.props).toMatchObject({
      state: 'unavailable',
      deliveries: [],
    });
    coordinator.dispose();
  });

  it('records a timeline publication failure and retries on the next source snapshot', async () => {
    const { coordinator, updateTimeline, setCompleteSnapshot, emit } = makeHarness();
    const publicationError = new Error('native widget update failed');
    updateTimeline.mockImplementationOnce(() => {
      throw publicationError;
    });

    coordinator.setSession('user-a', 7);
    await flushWidgetDriver();

    expect(mockRecordWidgetOperationalFailure).toHaveBeenCalledWith(
      'delivery_timeline_publish_failed',
      'update_timeline',
      publicationError,
    );

    const confirmedSnapshot = makeSnapshot('user-a');
    setCompleteSnapshot(confirmedSnapshot);
    emit({ type: 'complete', snapshot: confirmedSnapshot });
    expect(updateTimeline).toHaveBeenCalledTimes(2);
    expect(updateTimeline.mock.calls[1]?.[0][0]?.props).toMatchObject({
      state: 'pending',
      deliveryCount: 1,
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

  it('keeps the last complete timeline during revalidation and publishes the confirmed mutation', async () => {
    const initial = makeSnapshot('user-a');
    const { coordinator, updateTimeline, setCompleteSnapshot, emit } = makeHarness(initial);
    coordinator.setSession('user-a', 7);
    await flushWidgetDriver();

    emit({ type: 'refreshing', uid: 'user-a', date: '2026-10-15' });
    expect(updateTimeline).toHaveBeenCalledTimes(1);
    expect(updateTimeline.mock.calls[0]?.[0][0]?.props).toMatchObject({ state: 'pending' });

    const allCompleted = {
      ...initial,
      deliveries: [{ ...initial.deliveries[0]!, entregue: true }],
    };
    setCompleteSnapshot(allCompleted);
    emit({ type: 'complete', cause: 'mutation', snapshot: allCompleted });

    expect(updateTimeline).toHaveBeenCalledTimes(2);
    expect(updateTimeline.mock.calls[1]?.[0][0]?.props).toMatchObject({
      state: 'all_completed',
      deliveries: [],
    });
    coordinator.dispose();
  });

  it('distinguishes a confirmed empty day from unavailable data and resets on date change', async () => {
    const { coordinator, updateTimeline, setCompleteSnapshot, setDate, emit } = makeHarness();
    coordinator.setSession('user-a', 7);
    await flushWidgetDriver();
    expect(updateTimeline.mock.calls[0]?.[0][0]?.props).toMatchObject({ state: 'unavailable' });

    const emptySnapshot = { ...makeSnapshot('user-a'), deliveries: [] };
    setCompleteSnapshot(emptySnapshot);
    emit({ type: 'complete', cause: 'query', snapshot: emptySnapshot });
    expect(updateTimeline.mock.calls[1]?.[0][0]?.props).toMatchObject({ state: 'empty' });

    emit({ type: 'invalidated', uid: 'user-a', date: '2026-10-15' });
    expect(updateTimeline.mock.calls[2]?.[0][0]?.props).toMatchObject({ state: 'unavailable' });

    setDate(new Date(2026, 9, 16, 12));
    coordinator.refreshAvailableSnapshot('user-a', 7);
    const countAfterDateChange = updateTimeline.mock.calls.length;
    emit({ type: 'complete', cause: 'query', snapshot: makeSnapshot('user-a') });
    expect(updateTimeline).toHaveBeenCalledTimes(countAfterDateChange);
    expect(updateTimeline.mock.calls.at(-1)?.[0][0]?.props).toMatchObject({
      date: '2026-10-16',
      state: 'unavailable',
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
