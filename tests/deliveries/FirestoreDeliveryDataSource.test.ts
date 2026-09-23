import * as firestoreModule from 'firebase/firestore';

import {
  FirestoreDeliveryDataSource,
  setFirestoreDeliveryDataSourceOpsForTesting,
} from '@/services/deliveries/FirestoreDeliveryDataSource';
import { firestoreDeliveryCacheService } from '@/services/deliveries/FirestoreDeliveryCacheService';
import { firestoreHistoricalDeliveryCache } from '@/services/deliveries/FirestoreHistoricalDeliveryCache';
import { financialPeriodSnapshotCache } from '@/services/finance/FinancialPeriodSnapshotCache';
import type { Delivery } from '@/types/data';

const mockAsyncStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockAsyncStorage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockAsyncStorage.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockAsyncStorage.delete(key);
    }),
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
const mockedGetDoc = jest.mocked(firestoreModule.getDoc);
const mockedSetDoc = jest.mocked(firestoreModule.setDoc);
const mockedUpdateDoc = jest.mocked(firestoreModule.updateDoc);

describe('FirestoreDeliveryDataSource - loadAllHistorical & Cache', () => {
  beforeAll(() => {
    setFirestoreDeliveryDataSourceOpsForTesting(firestoreModule, {});
  });

  afterAll(() => {
    setFirestoreDeliveryDataSourceOpsForTesting(undefined);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.clear();
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

  it('revalidates a cached historical snapshot when explicitly requested', async () => {
    const cachedDelivery: Delivery = {
      id: 'del-cached-revalidate',
      clientId: 'client:andre',
      cliente: 'André',
      data: '2026-08-12',
      quantidade: 1,
      valor: 50,
      status: 'Pago',
      entregue: true,
    };
    const remoteDelivery: Delivery = {
      ...cachedDelivery,
      id: 'del-remote-revalidate',
      data: '2026-09-02',
    };
    await firestoreHistoricalDeliveryCache.write('uid-test', [cachedDelivery]);

    let resolveFirestore: (
      value: Awaited<ReturnType<typeof firestoreModule.getDocs>>,
    ) => void = () => undefined;
    const pendingFirestore = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>(
      (resolve) => {
        resolveFirestore = resolve;
      },
    );
    mockedGetDocs.mockReturnValueOnce(pendingFirestore);

    const dataSource = new FirestoreDeliveryDataSource();
    const load = dataSource.loadAllHistorical('uid-test', undefined, { revalidate: true });
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(mockedGetDocs).toHaveBeenCalledTimes(1);
    expect(dataSource.getCached({ mode: 'all' }, 'uid-test')).toEqual([cachedDelivery]);

    resolveFirestore({
      empty: false,
      metadata: { fromCache: false },
      docs: [
        {
          id: remoteDelivery.id,
          data: () => ({
            clientId: 'andre',
            clientNameSnapshot: remoteDelivery.cliente,
            date: remoteDelivery.data,
            quantity: remoteDelivery.quantidade,
            totalValue: remoteDelivery.valor,
            status: remoteDelivery.status,
            delivered: remoteDelivery.entregue,
          }),
        },
      ],
    } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);

    await expect(load).resolves.toEqual([remoteDelivery]);
    expect(dataSource.getHistoricalDataState()).toBe('remote');
    expect(dataSource.getCached({ mode: 'all' }, 'uid-test')).toEqual([remoteDelivery]);
  });

  it('hydrates the historical cache for first-render filtered queries', async () => {
    const cachedDeliveries: Delivery[] = [
      {
        id: 'del-open-cached',
        clientId: 'client:andre',
        cliente: 'André',
        data: '2026-08-12',
        quantidade: 4,
        valor: 200,
        status: 'Não Pago',
        entregue: true,
      },
    ];
    await firestoreHistoricalDeliveryCache.write('uid-test', cachedDeliveries);

    const dataSource = new FirestoreDeliveryDataSource();
    await dataSource.hydrateFromCache('uid-test', '2026-08-30');

    expect(
      dataSource.getCached(
        { mode: 'all', status: 'Não Pago', deliveryStatus: 'Entregue' },
        'uid-test',
      ),
    ).toEqual(cachedDeliveries);
    expect(mockedGetDocs).not.toHaveBeenCalled();
  });

  it('keeps hydration local and completes when the historical cache is missing', async () => {
    const dataSource = new FirestoreDeliveryDataSource();
    await expect(dataSource.hydrateFromCache('uid-test', '2026-08-30')).resolves.toBe(false);

    expect(mockedGetDocs).not.toHaveBeenCalled();
    expect(dataSource.getCached({ mode: 'all' }, 'uid-test')).toEqual([]);
    expect(firestoreHistoricalDeliveryCache.getMemory('uid-test')).toBeNull();
  });

  it('preserves local deliveries when Firestore returns empty fromCache history', async () => {
    const cachedDelivery: Delivery = {
      id: 'del-offline-cache',
      clientId: 'client:andre',
      cliente: 'André',
      data: '2026-08-29',
      quantidade: 2,
      valor: 100,
      status: 'Não Pago',
      entregue: true,
    };
    await firestoreDeliveryCacheService.write('uid-test', '2026-08-29', [cachedDelivery]);

    const dataSource = new FirestoreDeliveryDataSource();
    await dataSource.hydrateFromCache('uid-test', '2026-08-29');
    mockedGetDocs.mockResolvedValueOnce({
      empty: true,
      metadata: { fromCache: true },
      docs: [],
    } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);

    await expect(dataSource.loadAllHistorical('uid-test')).resolves.toHaveLength(1);

    expect(firestoreHistoricalDeliveryCache.getMemory('uid-test')).toBeNull();
    expect(dataSource.getCached({ mode: 'all' }, 'uid-test')).toEqual([cachedDelivery]);
    expect(dataSource.getHistoricalDataState()).toBe('partial');
  });

  it('incorporates the complete historical cache after a filtered remote load', async () => {
    const cachedDeliveries: Delivery[] = [
      {
        id: 'del-filtered',
        clientId: 'client:andre',
        cliente: 'André',
        data: '2026-08-29',
        quantidade: 2,
        valor: 100,
        status: 'Pago',
        entregue: true,
      },
      {
        id: 'del-other-date',
        clientId: 'client:joao',
        cliente: 'João',
        data: '2026-08-28',
        quantidade: 1,
        valor: 50,
        status: 'Não Pago',
        entregue: true,
      },
    ];
    await firestoreHistoricalDeliveryCache.write('uid-test', cachedDeliveries);
    let resolveFiltered: (
      value: Awaited<ReturnType<typeof firestoreModule.getDocs>>,
    ) => void = () => undefined;
    const filteredRequest = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>(
      (resolve) => {
        resolveFiltered = resolve;
      },
    );
    mockedGetDocs.mockReturnValueOnce(filteredRequest);

    const dataSource = new FirestoreDeliveryDataSource();
    const filteredLoad = dataSource.load('uid-test', { mode: 'today', date: '2026-08-29' });
    await new Promise<void>((resolve) => setImmediate(resolve));
    const historicalLoad = dataSource.loadAllHistorical('uid-test');

    await expect(historicalLoad).resolves.toEqual(cachedDeliveries);
    resolveFiltered({
      empty: false,
      metadata: { fromCache: false },
      docs: [
        {
          id: 'del-filtered',
          data: () => ({
            clientId: 'andre',
            clientNameSnapshot: 'André',
            date: '2026-08-29',
            quantity: 1,
            totalValue: 50,
            status: 'Não Pago',
            delivered: true,
          }),
        },
      ],
    } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);
    await filteredLoad;

    expect(dataSource.getCached({ mode: 'all' }, 'uid-test')).toEqual(cachedDeliveries);
    expect(dataSource.getHistoricalDataState()).toBe('cache');
    expect(mockedGetDocs).toHaveBeenCalledTimes(1);
  });

  it('preserves the daily cache when a filtered fromCache response is empty', async () => {
    const cachedDelivery: Delivery = {
      id: 'del-daily-cache',
      clientId: 'client:andre',
      cliente: 'André',
      data: '2026-08-29',
      quantidade: 2,
      valor: 100,
      status: 'Não Pago',
      entregue: true,
    };
    await firestoreDeliveryCacheService.write('uid-test', '2026-08-29', [cachedDelivery]);

    const dataSource = new FirestoreDeliveryDataSource();
    await dataSource.hydrateFromCache('uid-test', '2026-08-29');
    mockedGetDocs.mockResolvedValueOnce({
      empty: true,
      metadata: { fromCache: true },
      docs: [],
    } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);

    await dataSource.load('uid-test', { mode: 'today', date: '2026-08-29' });

    expect(dataSource.getCached({ mode: 'today', date: '2026-08-29' }, 'uid-test')).toEqual([
      cachedDelivery,
    ]);
    await expect(firestoreDeliveryCacheService.read('uid-test', '2026-08-29')).resolves.toEqual([
      cachedDelivery,
    ]);
  });

  it('does not overwrite a cached delivery with a partial fromCache record', async () => {
    const cachedDelivery: Delivery = {
      id: 'del-daily-partial',
      clientId: 'client:andre',
      cliente: 'André',
      data: '2026-08-29',
      quantidade: 2,
      valor: 100,
      status: 'Pago',
      entregue: true,
    };
    await firestoreDeliveryCacheService.write('uid-test', '2026-08-29', [cachedDelivery]);

    const dataSource = new FirestoreDeliveryDataSource();
    await dataSource.hydrateFromCache('uid-test', '2026-08-29');
    mockedGetDocs.mockResolvedValueOnce({
      empty: false,
      metadata: { fromCache: true },
      docs: [
        {
          id: cachedDelivery.id,
          data: () => ({
            clientId: 'andre',
            clientNameSnapshot: 'Nome parcial',
            date: cachedDelivery.data,
            quantity: 1,
            totalValue: 50,
            status: 'Não Pago',
            delivered: false,
          }),
        },
      ],
    } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);

    await dataSource.load('uid-test', { mode: 'today', date: '2026-08-29' });

    expect(dataSource.getCached({ mode: 'today', date: '2026-08-29' }, 'uid-test')).toEqual([
      cachedDelivery,
    ]);
  });

  it('does not let an older daily cache replace a newer historical cache', async () => {
    const historicalDelivery: Delivery = {
      id: 'del-historical-newer',
      clientId: 'client:andre',
      cliente: 'André',
      data: '2026-08-29',
      quantidade: 3,
      valor: 150,
      status: 'Pago',
      entregue: true,
    };
    const dailyDelivery = { ...historicalDelivery, status: 'Não Pago' as const };
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValueOnce(200).mockReturnValueOnce(100);
    await firestoreHistoricalDeliveryCache.write('uid-test', [historicalDelivery]);
    await firestoreDeliveryCacheService.write('uid-test', '2026-08-29', [dailyDelivery]);
    now.mockRestore();

    const dataSource = new FirestoreDeliveryDataSource();
    await dataSource.hydrateFromCache('uid-test', '2026-08-29');

    expect(dataSource.getCached({ mode: 'today', date: '2026-08-29' }, 'uid-test')).toEqual([
      historicalDelivery,
    ]);
  });

  it('merges a newer daily cache by id without removing historical records', async () => {
    const historicalDeliveries: Delivery[] = [
      {
        id: 'del-daily-merge-update',
        clientId: 'client:andre',
        cliente: 'André',
        data: '2026-08-29',
        quantidade: 2,
        valor: 100,
        status: 'Pago',
        entregue: true,
      },
      {
        id: 'del-daily-merge-preserve',
        clientId: 'client:andre',
        cliente: 'André',
        data: '2026-08-29',
        quantidade: 1,
        valor: 50,
        status: 'Não Pago',
        entregue: true,
      },
    ];
    const dailyUpdate = {
      ...historicalDeliveries[0],
      quantidade: 3,
      valor: 150,
      status: 'Não Pago' as const,
    };
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValueOnce(100).mockReturnValueOnce(200);
    await firestoreHistoricalDeliveryCache.write('uid-test', historicalDeliveries);
    await firestoreDeliveryCacheService.write('uid-test', '2026-08-29', [dailyUpdate]);
    now.mockRestore();

    const dataSource = new FirestoreDeliveryDataSource();
    await dataSource.hydrateFromCache('uid-test', '2026-08-29');

    expect(dataSource.getCached({ mode: 'all' }, 'uid-test')).toEqual([
      dailyUpdate,
      historicalDeliveries[1],
    ]);
  });

  it('does not overwrite a newer daily cache with an older write', async () => {
    const newerDelivery: Delivery = {
      id: 'del-daily-newer',
      clientId: 'client:andre',
      cliente: 'André',
      data: '2026-08-29',
      quantidade: 3,
      valor: 150,
      status: 'Pago',
      entregue: true,
    };
    const olderDelivery = { ...newerDelivery, status: 'Não Pago' as const };
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValueOnce(200).mockReturnValueOnce(100);
    await firestoreDeliveryCacheService.write('uid-test', '2026-08-29', [newerDelivery]);
    await firestoreDeliveryCacheService.write('uid-test', '2026-08-29', [olderDelivery]);
    now.mockRestore();

    await expect(firestoreDeliveryCacheService.read('uid-test', '2026-08-29')).resolves.toEqual([
      newerDelivery,
    ]);
  });

  it('coalesces concurrent historical loads for one session', async () => {
    let resolveFirestore: (
      value: Awaited<ReturnType<typeof firestoreModule.getDocs>>,
    ) => void = () => undefined;
    const pendingFirestore = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>(
      (resolve) => {
        resolveFirestore = resolve;
      },
    );
    mockedGetDocs.mockReturnValueOnce(pendingFirestore);

    const dataSource = new FirestoreDeliveryDataSource();
    const firstLoad = dataSource.loadAllHistorical('uid-test');
    const secondLoad = dataSource.loadAllHistorical('uid-test');
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(mockedGetDocs).toHaveBeenCalledTimes(1);

    resolveFirestore({ empty: true, docs: [] } as unknown as Awaited<
      ReturnType<typeof firestoreModule.getDocs>
    >);
    await expect(Promise.all([firstLoad, secondLoad])).resolves.toEqual([[], []]);
    expect(mockedGetDocs).toHaveBeenCalledTimes(1);
  });

  it('keeps independent delivery queries when they complete out of order', async () => {
    const deliveryForDate = (id: string, date: string): Delivery => ({
      id,
      clientId: 'client:andre',
      cliente: 'André',
      data: date,
      quantidade: 2,
      valor: 100,
      status: 'Pago',
      entregue: true,
    });
    let resolveFirst: (value: Awaited<ReturnType<typeof firestoreModule.getDocs>>) => void = () =>
      undefined;
    let resolveSecond: (value: Awaited<ReturnType<typeof firestoreModule.getDocs>>) => void = () =>
      undefined;
    const firstRequest = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>(
      (resolve) => {
        resolveFirst = resolve;
      },
    );
    const secondRequest = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>(
      (resolve) => {
        resolveSecond = resolve;
      },
    );
    mockedGetDocs.mockReturnValueOnce(firstRequest).mockReturnValueOnce(secondRequest);

    const dataSource = new FirestoreDeliveryDataSource();
    const firstLoad = dataSource.load('uid-test', { mode: 'today', date: '2026-08-28' });
    await new Promise<void>((resolve) => setImmediate(resolve));
    const secondLoad = dataSource.load('uid-test', { mode: 'today', date: '2026-08-29' });
    await new Promise<void>((resolve) => setImmediate(resolve));

    resolveSecond({
      empty: false,
      docs: [
        {
          id: 'del-newer',
          data: () => ({
            clientId: 'andre',
            clientNameSnapshot: 'André',
            date: '2026-08-29',
            quantity: 2,
            totalValue: 100,
            status: 'Pago',
            delivered: true,
          }),
        },
      ],
    } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);
    await secondLoad;
    resolveFirst({
      empty: false,
      docs: [
        {
          id: 'del-older',
          data: () => ({
            clientId: 'andre',
            clientNameSnapshot: 'André',
            date: '2026-08-28',
            quantity: 2,
            totalValue: 100,
            status: 'Pago',
            delivered: true,
          }),
        },
      ],
    } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);
    await firstLoad;

    expect(dataSource.getCached({ mode: 'today', date: '2026-08-29' }, 'uid-test')).toHaveLength(1);
    expect(
      dataSource.getCached({ mode: 'today', date: '2026-08-29' }, 'uid-test')[0],
    ).toMatchObject(deliveryForDate('del-newer', '2026-08-29'));
    expect(dataSource.getCached({ mode: 'today', date: '2026-08-28' }, 'uid-test')).toHaveLength(1);
  });

  it('discards an older response for the same delivery query', async () => {
    let resolveFirst: (value: Awaited<ReturnType<typeof firestoreModule.getDocs>>) => void = () =>
      undefined;
    let resolveSecond: (value: Awaited<ReturnType<typeof firestoreModule.getDocs>>) => void = () =>
      undefined;
    const firstRequest = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>(
      (resolve) => {
        resolveFirst = resolve;
      },
    );
    const secondRequest = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>(
      (resolve) => {
        resolveSecond = resolve;
      },
    );
    mockedGetDocs.mockReturnValueOnce(firstRequest).mockReturnValueOnce(secondRequest);

    const dataSource = new FirestoreDeliveryDataSource();
    const filters = { mode: 'today' as const, date: '2026-08-29' };
    const firstLoad = dataSource.load('uid-test', filters);
    await new Promise<void>((resolve) => setImmediate(resolve));
    const secondLoad = dataSource.load('uid-test', filters, { force: true });
    await new Promise<void>((resolve) => setImmediate(resolve));

    resolveSecond({
      empty: false,
      docs: [
        {
          id: 'del-newer',
          data: () => ({
            clientId: 'andre',
            clientNameSnapshot: 'André',
            date: '2026-08-29',
            quantity: 3,
            totalValue: 150,
            status: 'Pago',
            delivered: true,
          }),
        },
      ],
    } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);
    await secondLoad;

    resolveFirst({
      empty: false,
      docs: [
        {
          id: 'del-older',
          data: () => ({
            clientId: 'andre',
            clientNameSnapshot: 'André',
            date: '2026-08-29',
            quantity: 1,
            totalValue: 50,
            status: 'Não Pago',
            delivered: true,
          }),
        },
      ],
    } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);
    await firstLoad;

    expect(dataSource.getCached(filters, 'uid-test')).toEqual([
      expect.objectContaining({ id: 'del-newer', quantidade: 3 }),
    ]);
  });

  it('does not let an older date query degrade an applied historical load', async () => {
    let resolveFiltered: (
      value: Awaited<ReturnType<typeof firestoreModule.getDocs>>,
    ) => void = () => undefined;
    let resolveHistorical: (
      value: Awaited<ReturnType<typeof firestoreModule.getDocs>>,
    ) => void = () => undefined;
    const filteredRequest = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>(
      (resolve) => {
        resolveFiltered = resolve;
      },
    );
    const historicalRequest = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>(
      (resolve) => {
        resolveHistorical = resolve;
      },
    );
    mockedGetDocs.mockReturnValueOnce(filteredRequest).mockReturnValueOnce(historicalRequest);

    const dataSource = new FirestoreDeliveryDataSource();
    const filters = { mode: 'today' as const, date: '2026-08-29' };
    const filteredLoad = dataSource.load('uid-test', filters);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(mockedGetDocs).toHaveBeenCalledTimes(1);

    const historicalLoad = dataSource.loadAllHistorical('uid-test');
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(mockedGetDocs).toHaveBeenCalledTimes(2);

    resolveHistorical({
      empty: false,
      metadata: { fromCache: false },
      docs: [
        {
          id: 'history-a',
          data: () => ({
            clientId: 'andre',
            clientNameSnapshot: 'André',
            date: '2026-08-29',
            quantity: 3,
            totalValue: 150,
            status: 'Pago',
            delivered: true,
          }),
        },
        {
          id: 'history-b',
          data: () => ({
            clientId: 'joao',
            clientNameSnapshot: 'João',
            date: '2026-08-29',
            quantity: 2,
            totalValue: 100,
            status: 'Não Pago',
            delivered: true,
          }),
        },
      ],
    } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);
    await historicalLoad;

    resolveFiltered({
      empty: false,
      metadata: { fromCache: false },
      docs: [
        {
          id: 'history-a',
          data: () => ({
            clientId: 'andre',
            clientNameSnapshot: 'André',
            date: '2026-08-29',
            quantity: 1,
            totalValue: 50,
            status: 'Não Pago',
            delivered: true,
          }),
        },
      ],
    } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);
    await filteredLoad;

    expect(dataSource.getCached({ mode: 'all' }, 'uid-test')).toEqual([
      expect.objectContaining({ id: 'history-a', quantidade: 3, valor: 150 }),
      expect.objectContaining({ id: 'history-b', quantidade: 2, valor: 100 }),
    ]);
  });

  it('rejects a pending delivery mutation after logout or user change', async () => {
    let resolveWrite: () => void = () => undefined;
    const pendingWrite = new Promise<void>((resolve) => {
      resolveWrite = resolve;
    });
    mockedSetDoc.mockReturnValueOnce(pendingWrite);

    const dataSource = new FirestoreDeliveryDataSource();
    dataSource.setSessionUser('uid-old');
    const createPromise = dataSource.create('uid-old', {
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
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(mockedSetDoc).toHaveBeenCalledTimes(1);

    dataSource.setSessionUser('uid-new');
    resolveWrite();

    await expect(createPromise).rejects.toThrow('Sessão alterada durante a operação.');
    expect(dataSource.getCached({ mode: 'all' }, 'uid-new')).toEqual([]);
  });

  it('discards a historical response after the session changes', async () => {
    let resolveFirestore: (
      value: Awaited<ReturnType<typeof firestoreModule.getDocs>>,
    ) => void = () => undefined;
    const pendingFirestore = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>(
      (resolve) => {
        resolveFirestore = resolve;
      },
    );
    mockedGetDocs.mockReturnValueOnce(pendingFirestore);

    const dataSource = new FirestoreDeliveryDataSource();
    dataSource.setSessionUser('uid-old');
    const loadPromise = dataSource.loadAllHistorical('uid-old');
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(mockedGetDocs).toHaveBeenCalledTimes(1);
    dataSource.setSessionUser('uid-new');
    resolveFirestore({ empty: false, docs: [] } as unknown as Awaited<
      ReturnType<typeof firestoreModule.getDocs>
    >);

    await expect(loadPromise).resolves.toEqual([]);
    expect(dataSource.getCached({ mode: 'all' }, 'uid-new')).toEqual([]);
  });

  it('requires fresh hydration after a same-uid session version changes', async () => {
    const cachedDeliveries: Delivery[] = [
      {
        id: 'del-same-uid-session',
        cliente: 'André',
        data: '2026-08-30',
        quantidade: 1,
        valor: 50,
        status: 'Não Pago',
        entregue: true,
      },
    ];
    await firestoreHistoricalDeliveryCache.write('uid-test', cachedDeliveries);

    const dataSource = new FirestoreDeliveryDataSource();
    dataSource.setSessionUser('uid-test', 1);
    await dataSource.hydrateFromCache('uid-test', '2026-08-30');
    expect(dataSource.getCached({ mode: 'all' }, 'uid-test', 1)).toEqual(cachedDeliveries);

    dataSource.setSessionUser('uid-test', 2);

    expect(dataSource.getCached({ mode: 'all' }, 'uid-test', 2)).toEqual([]);
    await dataSource.hydrateFromCache('uid-test', '2026-08-30');
    expect(dataSource.getCached({ mode: 'all' }, 'uid-test', 2)).toEqual(cachedDeliveries);
  });

  it('keeps historical deliveries when the daily cache is unavailable', async () => {
    const cachedDeliveries: Delivery[] = [
      {
        id: 'del-today-historical',
        cliente: 'André',
        data: '2026-08-30',
        quantidade: 1,
        valor: 50,
        status: 'Não Pago',
        entregue: true,
      },
    ];
    await firestoreHistoricalDeliveryCache.write('uid-test', cachedDeliveries);

    const dataSource = new FirestoreDeliveryDataSource();
    await dataSource.hydrateFromCache('uid-test', '2026-08-30');

    expect(dataSource.getCached({ mode: 'today', date: '2026-08-30' }, 'uid-test')).toEqual(
      cachedDeliveries,
    );
  });

  it('publishes a revision when hydration updates the cached records', async () => {
    const listener = jest.fn();
    const dataSource = new FirestoreDeliveryDataSource();
    const initialRevision = dataSource.getRevision();
    dataSource.subscribe(listener);

    await dataSource.hydrateFromCache('uid-test', '2026-08-30');

    expect(dataSource.getRevision()).toBe(initialRevision + 1);
    expect(listener).toHaveBeenCalledTimes(1);
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

  it('sets delivered idempotently, patches only delivery completion metadata, and publishes the snapshot', async () => {
    const invalidateFinancialMonth = jest.spyOn(financialPeriodSnapshotCache, 'invalidate');
    const dataSource = new FirestoreDeliveryDataSource();
    const listener = jest.fn();
    dataSource.subscribe(listener);
    await firestoreHistoricalDeliveryCache.write('uid-test', [
      {
        cliente: 'André',
        data: '2026-09-21',
        entregue: false,
        id: 'delivery-pending',
        metodoPagamento: 'Dinheiro',
        quantidade: 3,
        status: 'Não Pago',
        valor: 120,
      },
    ]);
    await dataSource.hydrateFromCache('uid-test', '2026-09-21');

    const revisionBeforeSet = dataSource.getRevision();
    await dataSource.setDelivered('uid-test', 'delivery-pending', true);

    expect(mockedUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockedUpdateDoc.mock.calls[0]?.[1]).toEqual({
      delivered: true,
      updatedAt: { type: 'serverTimestamp' },
    });
    expect(dataSource.getRevision()).toBe(revisionBeforeSet + 1);
    expect(listener).toHaveBeenCalled();
    expect(mockedGetDoc).not.toHaveBeenCalled();
    expect(invalidateFinancialMonth).toHaveBeenCalledWith('uid-test', '2026-09');
    expect(dataSource.getCached({ mode: 'all' }, 'uid-test')).toMatchObject([
      {
        data: '2026-09-21',
        entregue: true,
        id: 'delivery-pending',
        metodoPagamento: 'Dinheiro',
        quantidade: 3,
        status: 'Não Pago',
        valor: 120,
      },
    ]);

    const revisionAfterSet = dataSource.getRevision();
    await dataSource.setDelivered('uid-test', 'delivery-pending', true);

    expect(mockedUpdateDoc).toHaveBeenCalledTimes(1);
    expect(dataSource.getRevision()).toBe(revisionAfterSet);
    expect(firestoreHistoricalDeliveryCache.getMemory('uid-test')).toBeNull();
    invalidateFinancialMonth.mockRestore();
  });
});
