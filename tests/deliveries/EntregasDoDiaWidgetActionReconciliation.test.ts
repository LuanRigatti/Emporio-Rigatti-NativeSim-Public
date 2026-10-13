import type { WidgetTimelineEntry } from 'expo-widgets';

import {
  EntregasDoDiaSnapshotCoordinator,
  type DeliverySnapshotSource,
} from '@/features/deliveries/widgets/EntregasDoDiaSnapshotCoordinator';
import type { EntregasDoDiaWidgetTimelineProps } from '@/features/deliveries/widgets/EntregasDoDiaSnapshot';
import type { CompleteDeliveryDateSnapshot } from '@/services/deliveries/FirestoreDeliveryDataSource';

jest.mock('@/services/deliveries/FirestoreDeliveryDataSource', () => ({
  firestoreDeliveryDataSource: {
    subscribeDateSnapshots: () => () => undefined,
    getCompleteDateSnapshot: () => null,
  },
}));

const UID = 'user-a';
const DATE = '2026-10-15';
const SESSION_ID = 'widget-session-a';

function snapshot(
  deliveries: CompleteDeliveryDateSnapshot['deliveries'],
): CompleteDeliveryDateSnapshot {
  return { uid: UID, date: DATE, deliveries, completedAt: Date.now() };
}

const priorDeliveries: CompleteDeliveryDateSnapshot['deliveries'] = [
  {
    id: 'delivery-a',
    cliente: 'Cliente A',
    data: DATE,
    quantidade: 1,
    valor: 50,
    status: 'Não Pago',
    entregue: false,
  },
  {
    id: 'delivery-b',
    cliente: 'Cliente B',
    data: DATE,
    quantidade: 2,
    valor: 100,
    status: 'Não Pago',
    entregue: false,
  },
];

describe('EntregasDoDia widget action reconciliation', () => {
  it('force-loads a complete canonical day after action success and advances to the next pending row', async () => {
    let canonicalSnapshot = snapshot(priorDeliveries);
    let receipts = [{ id: 'receipt-1', date: DATE, revision: 1 }];
    const source: DeliverySnapshotSource = {
      subscribeDateSnapshots: () => () => undefined,
      getCompleteDateSnapshot: jest.fn(() => canonicalSnapshot),
      load: jest.fn(async (_uid, filters, options) => {
        expect(filters).toEqual({ mode: 'today', date: DATE });
        expect(options).toEqual({ force: true });
        canonicalSnapshot = snapshot([
          { ...priorDeliveries[0]!, entregue: true },
          priorDeliveries[1]!,
        ]);
        return [...canonicalSnapshot.deliveries];
      }),
    };
    const actionStateStore = {
      authorizationMetadata: () => ({ uid: UID, sessionId: SESSION_ID }),
      actionRevision: jest.fn(() => 1),
      pendingReceipts: jest.fn(() => receipts),
      acknowledgeReceipts: jest.fn((identifiers: string[]) => {
        receipts = receipts.filter(({ id }) => !identifiers.includes(id));
      }),
    };
    const updateTimeline = jest.fn();
    const coordinator = new EntregasDoDiaSnapshotCoordinator({
      source,
      isIOS: true,
      now: () => new Date(2026, 9, 15, 12),
      routeURL: () => 'pareact://historico?mode=wholesale',
      deliveryURL: (id) => `pareact://historico/entrega/${id}?date=${DATE}`,
      actionStateStore,
      loadWidget: async () => ({ updateTimeline }),
    });

    coordinator.setSession(UID, 7);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(source.load).toHaveBeenCalledTimes(1);
    expect(actionStateStore.acknowledgeReceipts).toHaveBeenCalledWith(['receipt-1']);
    expect(receipts).toHaveLength(0);
    expect(updateTimeline.mock.calls.at(-1)?.[0][0]?.props).toMatchObject({
      date: DATE,
      state: 'pending',
      deliveryCount: 1,
      deliveries: [{ id: 'delivery-b' }],
      actionSessionId: SESSION_ID,
      actionRevision: 1,
    });
    coordinator.dispose();
  });

  it('keeps the extension-confirmed timeline when the app cannot reconcile offline', async () => {
    const confirmedTimeline: WidgetTimelineEntry<EntregasDoDiaWidgetTimelineProps>[] = [
      {
        date: new Date(2026, 9, 15, 12),
        props: {
          date: DATE,
          state: 'pending',
          deliveryCount: 1,
          deliveries: [
            {
              id: 'delivery-b',
              clientName: 'Cliente B',
              quantityLabel: '2 baldes',
              valueLabel: 'R$ 100,00',
            },
          ],
          actionSessionId: SESSION_ID,
          actionRevision: 1,
          deliveryRouteURL: 'pareact://historico?mode=wholesale',
        },
      },
    ];
    const receipts = [{ id: 'receipt-1', date: DATE, revision: 1 }];
    const source: DeliverySnapshotSource = {
      subscribeDateSnapshots: () => () => undefined,
      getCompleteDateSnapshot: jest.fn(() => null),
      load: jest.fn(async () => {
        throw new Error('offline');
      }),
    };
    const actionStateStore = {
      authorizationMetadata: () => ({ uid: UID, sessionId: SESSION_ID }),
      actionRevision: jest.fn(() => 1),
      pendingReceipts: jest.fn(() => receipts),
      acknowledgeReceipts: jest.fn(),
    };
    const updateTimeline = jest.fn();
    const coordinator = new EntregasDoDiaSnapshotCoordinator({
      source,
      isIOS: true,
      now: () => new Date(2026, 9, 15, 12),
      routeURL: () => 'pareact://historico?mode=wholesale',
      actionStateStore,
      loadWidget: async () => ({
        updateTimeline,
        getTimeline: async () => confirmedTimeline,
      }),
    });

    coordinator.setSession(UID, 7);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(source.load).toHaveBeenCalledTimes(1);
    expect(actionStateStore.acknowledgeReceipts).not.toHaveBeenCalled();
    expect(updateTimeline).not.toHaveBeenCalled();
    coordinator.dispose();
  });

  it('does not preserve another account session timeline', async () => {
    const confirmedTimeline: WidgetTimelineEntry<EntregasDoDiaWidgetTimelineProps>[] = [
      {
        date: new Date(2026, 9, 15, 12),
        props: {
          date: DATE,
          state: 'pending',
          deliveryCount: 1,
          deliveries: [
            {
              id: 'delivery-other',
              clientName: 'Outro usuário',
              quantityLabel: '9 baldes',
              valueLabel: 'R$ 900,00',
            },
          ],
          actionSessionId: 'session-other-account',
          actionRevision: 1,
        },
      },
    ];
    const updateTimeline = jest.fn();
    const coordinator = new EntregasDoDiaSnapshotCoordinator({
      source: {
        subscribeDateSnapshots: () => () => undefined,
        getCompleteDateSnapshot: () => null,
      },
      isIOS: true,
      now: () => new Date(2026, 9, 15, 12),
      routeURL: () => 'pareact://historico?mode=wholesale',
      actionStateStore: {
        authorizationMetadata: () => ({ uid: UID, sessionId: SESSION_ID }),
        actionRevision: () => 1,
        pendingReceipts: () => [{ id: 'receipt-1', date: DATE, revision: 1 }],
        acknowledgeReceipts: jest.fn(),
      },
      loadWidget: async () => ({
        updateTimeline,
        getTimeline: async () => confirmedTimeline,
      }),
    });

    coordinator.setSession(UID, 7);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(updateTimeline.mock.calls.at(-1)?.[0][0]?.props).toMatchObject({
      state: 'unavailable',
      deliveries: [],
    });
    coordinator.dispose();
  });
});
