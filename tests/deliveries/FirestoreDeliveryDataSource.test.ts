import * as firestoreModule from 'firebase/firestore';

import {
  FirestoreDeliveryDataSource,
  setFirestoreDeliveryDataSourceOpsForTesting,
} from '@/services/deliveries/FirestoreDeliveryDataSource';
import { firestoreHistoricalDeliveryCache } from '@/services/deliveries/FirestoreHistoricalDeliveryCache';
import type { Delivery } from '@/types/data';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

jest.mock('@/services/firebase/firestore', () => ({
  __esModule: true,
  getFirebaseFirestore: jest.fn(() => ({})),
}));

jest.mock('firebase/firestore', () => ({
  __esModule: true,
  collection: jest.fn((...args: unknown[]) => ({ path: args.join('/') })),
  doc: jest.fn((...args: unknown[]) => ({ id: 'doc-mock-id', path: args.join('/') })),
  getDocs: jest.fn(async () => ({ empty: true, docs: [] })),
  getDoc: jest.fn(async () => ({ exists: () => false })),
  setDoc: jest.fn(async () => undefined),
  deleteDoc: jest.fn(async () => undefined),
  updateDoc: jest.fn(async () => undefined),
  limit: jest.fn((n: number) => ({ type: 'limit', value: n })),
  orderBy: jest.fn((field: string, dir: string) => ({ type: 'orderBy', field, dir })),
  query: jest.fn((...args: unknown[]) => ({ type: 'query', args })),
  startAfter: jest.fn((doc: unknown) => ({ type: 'startAfter', doc })),
  where: jest.fn((field: string, op: string, val: unknown) => ({ type: 'where', field, op, val })),
  serverTimestamp: jest.fn(() => ({ type: 'serverTimestamp' })),
}));

const mockedGetDocs = jest.mocked(firestoreModule.getDocs);
const mockedSetDoc = jest.mocked(firestoreModule.setDoc);

describe('FirestoreDeliveryDataSource - loadAllHistorical & Cache', () => {
  beforeAll(() => {
    setFirestoreDeliveryDataSourceOpsForTesting(firestoreModule, {});
  });

  afterAll(() => {
    setFirestoreDeliveryDataSourceOpsForTesting(undefined);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    firestoreHistoricalDeliveryCache.clearMemory();
  });

  it('loads all historical deliveries in batches of 250 with deterministic pagination and caches them', async () => {
    const page1Docs = Array.from({ length: 250 }, (_, i) => ({
      id: `del-p1-${i}`,
      data: () => ({
        clientId: 'client-1',
        clientNameSnapshot: 'Cliente 1',
        date: '2026-08-10',
        quantity: 2,
        totalValue: 100,
        status: 'Pago',
        delivered: true,
      }),
    }));

    const page2Docs = Array.from({ length: 50 }, (_, i) => ({
      id: `del-p2-${i}`,
      data: () => ({
        clientId: 'client-2',
        clientNameSnapshot: 'Cliente 2',
        date: '2025-05-12',
        quantity: 3,
        totalValue: 150,
        status: 'Pago',
        delivered: true,
      }),
    }));

    mockedGetDocs
      .mockResolvedValueOnce({
        empty: false,
        docs: page1Docs,
      } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>)
      .mockResolvedValueOnce({
        empty: false,
        docs: page2Docs,
      } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);

    const dataSource = new FirestoreDeliveryDataSource();
    const result = await dataSource.loadAllHistorical('uid-test');

    expect(mockedGetDocs).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(300);
    expect(result[0].id).toBe('del-p1-0');
    expect(result[299].id).toBe('del-p2-49');

    const memoryCache = firestoreHistoricalDeliveryCache.getMemory('uid-test');
    expect(memoryCache).toHaveLength(300);
  });

  it('reuses the historical cache on second call with 0 Firestore reads', async () => {
    const cachedDeliveries: Delivery[] = [
      {
        id: 'del-cached-1',
        clientId: 'client:andre',
        cliente: 'André',
        data: '2026-08-12',
        quantidade: 4,
        valor: 200,
        status: 'Pago',
        entregue: true,
      },
    ];

    await firestoreHistoricalDeliveryCache.write('uid-test', cachedDeliveries);

    const dataSource = new FirestoreDeliveryDataSource();
    const result = await dataSource.loadAllHistorical('uid-test');

    expect(mockedGetDocs).not.toHaveBeenCalled();
    expect(result).toEqual(cachedDeliveries);
  });

  it('invalidates historical cache when a new delivery is created', async () => {
    await firestoreHistoricalDeliveryCache.write('uid-test', [
      {
        id: 'del-1',
        cliente: 'Ana',
        data: '2026-08-12',
        quantidade: 2,
        valor: 100,
        status: 'Não Pago',
        entregue: true,
      },
    ]);

    expect(firestoreHistoricalDeliveryCache.getMemory('uid-test')).toHaveLength(1);

    const dataSource = new FirestoreDeliveryDataSource();
    await dataSource.create('uid-test', {
      clientId: 'client:novo',
      clientName: 'Novo Cliente',
      address: 'Rua Nova',
      addressConfirmed: true,
      valueWasManuallyChanged: false,
      invoiceStatus: 'a_emitir',
      date: '2026-08-18',
      quantity: 1,
      value: 50,
      delivered: true,
      status: 'Não Pago',
    });

    expect(mockedSetDoc).toHaveBeenCalledTimes(1);
    expect(firestoreHistoricalDeliveryCache.getMemory('uid-test')).toBeNull();
  });
});
