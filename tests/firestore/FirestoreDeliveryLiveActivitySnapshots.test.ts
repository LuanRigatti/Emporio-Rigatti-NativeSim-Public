import * as firestore from 'firebase/firestore';

import {
  FirestoreDeliveryDataSource,
  setFirestoreDeliveryDataSourceOpsForTesting,
} from '@/services/deliveries/FirestoreDeliveryDataSource';
import type { Delivery, DeliveryDraft } from '@/types/data';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  deleteDoc: jest.fn(async () => undefined),
  doc: jest.fn((_collection: unknown, id?: string) => ({ id: id ?? 'created-id' })),
  getDoc: jest.fn(async () => ({ exists: () => false, metadata: { fromCache: false } })),
  getDocs: jest.fn(async () => ({ docs: [], metadata: { fromCache: false } })),
  query: jest.fn(() => ({})),
  serverTimestamp: jest.fn(() => ({ __type: 'serverTimestamp' })),
  setDoc: jest.fn(async () => undefined),
  updateDoc: jest.fn(async () => undefined),
  where: jest.fn(() => ({})),
}));

jest.mock('@/services/deliveries/FirestoreDeliveryCacheService', () => ({
  firestoreDeliveryCacheService: {
    readEntry: jest.fn(async () => null),
    write: jest.fn(async () => undefined),
  },
}));

jest.mock('@/services/deliveries/FirestoreHistoricalDeliveryCache', () => ({
  firestoreHistoricalDeliveryCache: {
    clearMemory: jest.fn(),
    invalidate: jest.fn(async () => undefined),
    readEntry: jest.fn(async () => null),
    write: jest.fn(async () => undefined),
  },
}));

jest.mock('@/services/finance/FinancialPeriodSnapshotCache', () => ({
  financialPeriodSnapshotCache: { invalidate: jest.fn(async () => undefined) },
}));

type RawDelivery = {
  id: string;
  clientNameSnapshot: string;
  date: string;
  quantity: number;
  totalValue: number;
  status: string;
  delivered: boolean;
};

const UID = 'activity-test-user';
const SESSION_VERSION = 4;
const TODAY = '2026-10-03';
const mockGetDocs = firestore.getDocs as unknown as jest.Mock;
const mockGetDoc = firestore.getDoc as unknown as jest.Mock;

function rawDelivery(id: string, quantity = 1, date = TODAY): RawDelivery {
  return {
    id,
    clientNameSnapshot: `Cliente ${id}`,
    date,
    quantity,
    totalValue: quantity * 25,
    status: 'Não Pago',
    delivered: false,
  };
}

function querySnapshot(deliveries: RawDelivery[], fromCache = false): unknown {
  return {
    metadata: { fromCache },
    docs: deliveries.map((item) => ({ id: item.id, data: () => item })),
  };
}

function draft(quantity: number, date = TODAY): DeliveryDraft {
  return {
    address: 'Rua A',
    addressConfirmed: true,
    clientId: 'client:activity-test',
    clientName: 'Cliente de teste',
    date,
    delivered: false,
    invoiceStatus: 'a_emitir',
    quantity,
    status: 'Não Pago',
    value: quantity * 25,
    valueWasManuallyChanged: false,
    historicalUnitPrice: 25,
  };
}

function completeSnapshot(source: FirestoreDeliveryDataSource, date = TODAY) {
  return source.getCompleteDateSnapshot(UID, date, SESSION_VERSION);
}

describe('Firestore delivery Live Activity snapshots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDocs.mockResolvedValue(querySnapshot([]));
    setFirestoreDeliveryDataSourceOpsForTesting(
      firestore as unknown as typeof import('firebase/firestore'),
      {},
    );
  });

  afterEach(() => {
    setFirestoreDeliveryDataSourceOpsForTesting(undefined);
  });

  it('does not expose cache or partial data as a complete date, including an empty cache result', async () => {
    const source = new FirestoreDeliveryDataSource();
    source.setSessionUser(UID, SESSION_VERSION);
    mockGetDocs
      .mockResolvedValueOnce(querySnapshot([rawDelivery('cached')], true))
      .mockResolvedValueOnce(querySnapshot([], true));

    await source.load(UID, { mode: 'today', date: TODAY }, {}, SESSION_VERSION);
    await source.load(UID, { mode: 'today', date: TODAY }, { force: true }, SESSION_VERSION);

    expect(completeSnapshot(source)).toBeNull();
  });

  it('publishes a complete empty date only after a remote query finishes', async () => {
    const source = new FirestoreDeliveryDataSource();
    source.setSessionUser(UID, SESSION_VERSION);
    const events: unknown[] = [];
    source.subscribeDateSnapshots((event) => events.push(event));

    await source.load(UID, { mode: 'today', date: TODAY }, {}, SESSION_VERSION);

    expect(completeSnapshot(source)).toMatchObject({
      date: TODAY,
      deliveries: [],
      uid: UID,
    });
    expect(events).toEqual([
      expect.objectContaining({
        type: 'complete',
        snapshot: expect.objectContaining({ date: TODAY, deliveries: [] }),
      }),
    ]);
  });

  it('marks a prior complete snapshot stale when revalidation returns cache, preserving its records', async () => {
    const source = new FirestoreDeliveryDataSource();
    source.setSessionUser(UID, SESSION_VERSION);
    mockGetDocs.mockResolvedValueOnce(querySnapshot([rawDelivery('known', 2)]));
    await source.load(UID, { mode: 'today', date: TODAY }, {}, SESSION_VERSION);
    const events: string[] = [];
    source.subscribeDateSnapshots((event) => events.push(event.type));

    mockGetDocs.mockResolvedValueOnce(querySnapshot([], true));
    await source.load(UID, { mode: 'today', date: TODAY }, { force: true }, SESSION_VERSION);

    expect(completeSnapshot(source)).toBeNull();
    expect(source.getCached({ mode: 'today', date: TODAY }, UID, SESSION_VERSION)).toHaveLength(1);
    expect(events).toEqual(['invalidated']);
  });

  it('keeps the prior records but removes completeness when remote revalidation fails', async () => {
    const source = new FirestoreDeliveryDataSource();
    source.setSessionUser(UID, SESSION_VERSION);
    mockGetDocs.mockResolvedValueOnce(querySnapshot([rawDelivery('known', 2)]));
    await source.load(UID, { mode: 'today', date: TODAY }, {}, SESSION_VERSION);
    const events: string[] = [];
    source.subscribeDateSnapshots((event) => events.push(event.type));

    mockGetDocs.mockRejectedValueOnce(new Error('offline'));
    await expect(
      source.load(UID, { mode: 'today', date: TODAY }, { force: true }, SESSION_VERSION),
    ).rejects.toThrow('offline');

    expect(completeSnapshot(source)).toBeNull();
    expect(source.getCached({ mode: 'today', date: TODAY }, UID, SESSION_VERSION)).toHaveLength(1);
    expect(events).toEqual(['invalidated']);
  });

  it('publishes create, quantity/date update and delete from an existing complete baseline without extra reads', async () => {
    const source = new FirestoreDeliveryDataSource();
    source.setSessionUser(UID, SESSION_VERSION);
    mockGetDocs
      .mockResolvedValueOnce(querySnapshot([rawDelivery('first', 2), rawDelivery('second', 3)]))
      .mockResolvedValueOnce(querySnapshot([]));
    await source.load(UID, { mode: 'today', date: TODAY }, {}, SESSION_VERSION);
    await source.load(UID, { mode: 'today', date: '2026-10-04' }, {}, SESSION_VERSION);
    const snapshots: { date: string; deliveries: readonly Delivery[] }[] = [];
    source.subscribeDateSnapshots((event) => {
      if (event.type === 'complete') snapshots.push(event.snapshot);
    });

    await source.create(UID, draft(4));
    await source.update(UID, 'first', draft(5));
    await source.update(UID, 'second', draft(3, '2026-10-04'));
    await source.remove(UID, 'first');

    expect(snapshots.map(({ date, deliveries }) => [date, deliveries.map(({ id }) => id)])).toEqual(
      [
        [TODAY, ['first', 'second', 'created-id']],
        [TODAY, ['first', 'second', 'created-id']],
        [TODAY, ['first', 'created-id']],
        ['2026-10-04', ['second']],
        [TODAY, ['created-id']],
      ],
    );
    expect(snapshots[1]?.deliveries.find(({ id }) => id === 'first')?.quantidade).toBe(5);
    expect(snapshots[2]?.date).toBe(TODAY);
    expect(completeSnapshot(source, '2026-10-04')?.deliveries.map(({ id }) => id)).toEqual([
      'second',
    ]);
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('invalidates the complete-date marker without publishing a fabricated zero snapshot', async () => {
    const source = new FirestoreDeliveryDataSource();
    source.setSessionUser(UID, SESSION_VERSION);
    mockGetDocs.mockResolvedValueOnce(querySnapshot([rawDelivery('known', 2)]));
    await source.load(UID, { mode: 'today', date: TODAY }, {}, SESSION_VERSION);
    const events: unknown[] = [];
    source.subscribeDateSnapshots((event) => events.push(event));

    source.invalidateCompleteDateSnapshot(UID, TODAY, SESSION_VERSION);

    expect(completeSnapshot(source)).toBeNull();
    expect(events).toEqual([{ type: 'invalidated', uid: UID, date: TODAY }]);
  });
});
