import * as firestoreModule from 'firebase/firestore';

import { clientCatalogCache } from '@/services/clients/ClientCatalogCache';
import {
  FirestoreClientDataSource,
  setFirestoreClientDataSourceOpsForTesting,
} from '@/services/clients/FirestoreClientDataSource';

let mockAsyncStorage: Map<string, string> | undefined;

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockAsyncStorage?.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockAsyncStorage?.set(key, value);
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
  doc: jest.fn((...args: unknown[]) => ({ id: 'client-doc-id', path: args.join('/') })),
  getDocs: jest.fn(),
  serverTimestamp: jest.fn(() => ({ type: 'serverTimestamp' })),
  setDoc: jest.fn(async () => undefined),
  updateDoc: jest.fn(async () => undefined),
}));

const mockedGetDocs = jest.mocked(firestoreModule.getDocs);
const mockedSetDoc = jest.mocked(firestoreModule.setDoc);

const cachedRecord = {
  id: 'client-1',
  name: 'Ana',
  normalizedName: 'ana',
  address: 'Rua A',
  currentUnitPrice: 55,
};

describe('FirestoreClientDataSource - cache and session isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage = new Map<string, string>();
    setFirestoreClientDataSourceOpsForTesting(firestoreModule, {});
  });

  afterAll(() => {
    setFirestoreClientDataSourceOpsForTesting(undefined);
  });

  it('preserves hydrated clients when Firestore returns empty fromCache data', async () => {
    await clientCatalogCache.write('uid-test', [cachedRecord]);
    const dataSource = new FirestoreClientDataSource();
    dataSource.setSessionUser('uid-test');
    await dataSource.hydrateFromCache('uid-test');
    mockedGetDocs.mockResolvedValueOnce({
      docs: [],
      empty: true,
      metadata: { fromCache: true },
    } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);

    await dataSource.load('uid-test');

    expect(dataSource.list({}, 'uid-test')).toHaveLength(1);
    expect(mockAsyncStorage!.get('@pareact/client-catalog-cache-v1:uid-test')).toContain(
      'client-1',
    );
  });

  it('does not overwrite a cached client with a partial fromCache record', async () => {
    await clientCatalogCache.write('uid-test', [cachedRecord]);
    const dataSource = new FirestoreClientDataSource();
    dataSource.setSessionUser('uid-test');
    await dataSource.hydrateFromCache('uid-test');
    mockedGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'client-1',
          data: () => ({
            name: 'Nome parcial',
            normalizedName: 'nome-parcial',
            currentUnitPrice: 99,
          }),
        },
      ],
      empty: false,
      metadata: { fromCache: true },
    } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);

    await dataSource.load('uid-test');

    expect(dataSource.list({}, 'uid-test')[0]?.canonicalName).toBe('Ana');
  });

  it('does not expose the previous user during a session transition', async () => {
    await clientCatalogCache.write('uid-old', [cachedRecord]);
    const dataSource = new FirestoreClientDataSource();
    dataSource.setSessionUser('uid-old');
    await dataSource.hydrateFromCache('uid-old');

    dataSource.setSessionUser('uid-new');

    expect(dataSource.getSnapshot('uid-old')).toBeNull();
    expect(dataSource.getSnapshot('uid-new')).toBeNull();
    expect(dataSource.list({}, 'uid-new')).toEqual([]);
  });

  it('requires a fresh hydration after logout and relogin with the same uid', async () => {
    await clientCatalogCache.write('uid-test', [cachedRecord]);
    const dataSource = new FirestoreClientDataSource();
    dataSource.setSessionUser('uid-test');
    await dataSource.hydrateFromCache('uid-test');

    dataSource.setSessionUser();
    dataSource.setSessionUser('uid-test');
    expect(dataSource.list({}, 'uid-test')).toEqual([]);

    await dataSource.hydrateFromCache('uid-test');
    expect(dataSource.list({}, 'uid-test')).toHaveLength(1);
  });

  it('requires a fresh hydration when the same uid receives a new session version', async () => {
    await clientCatalogCache.write('uid-test', [cachedRecord]);
    const dataSource = new FirestoreClientDataSource();
    dataSource.setSessionUser('uid-test', 1);
    await dataSource.hydrateFromCache('uid-test');
    expect(dataSource.getSnapshot('uid-test', 1)).not.toBeNull();

    dataSource.setSessionUser('uid-test', 2);

    expect(dataSource.getSnapshot('uid-test', 2)).toBeNull();
    await dataSource.hydrateFromCache('uid-test');
    expect(dataSource.list({}, 'uid-test', 2)).toHaveLength(1);
  });

  it('does not reload or publish a client mutation after the session changes', async () => {
    let resolveWrite: () => void = () => undefined;
    const pendingWrite = new Promise<void>((resolve) => {
      resolveWrite = resolve;
    });
    mockedSetDoc.mockReturnValueOnce(pendingWrite);

    const dataSource = new FirestoreClientDataSource();
    dataSource.setSessionUser('uid-old', 1);
    const mutation = dataSource.saveCustomClient('uid-old', 'Novo Cliente', 55, 'Rua Nova');
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(mockedSetDoc).toHaveBeenCalledTimes(1);

    dataSource.setSessionUser('uid-new', 2);
    resolveWrite();

    await expect(mutation).rejects.toThrow('Sessão alterada durante a operação.');
    expect(mockedGetDocs).not.toHaveBeenCalled();
    expect(dataSource.getSnapshot('uid-new', 2)).toBeNull();
  });

  it('coalesces equivalent concurrent loads for the same session', async () => {
    let resolveLoad: (value: Awaited<ReturnType<typeof firestoreModule.getDocs>>) => void = () =>
      undefined;
    const pendingLoad = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>(
      (resolve) => {
        resolveLoad = resolve;
      },
    );
    mockedGetDocs.mockReturnValueOnce(pendingLoad);

    const dataSource = new FirestoreClientDataSource();
    dataSource.setSessionUser('uid-test', 1);
    const firstLoad = dataSource.load('uid-test', 1);
    const secondLoad = dataSource.load('uid-test', 1);

    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(mockedGetDocs).toHaveBeenCalledTimes(1);

    resolveLoad({
      docs: [
        {
          id: 'client-1',
          data: () => ({
            address: 'Rua A',
            currentUnitPrice: 55,
            name: 'Ana',
            normalizedName: 'ana',
          }),
        },
      ],
      metadata: { fromCache: false },
    } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);

    await Promise.all([firstLoad, secondLoad]);
    expect(mockedGetDocs).toHaveBeenCalledTimes(1);
    expect(dataSource.list({}, 'uid-test', 1)).toEqual([
      expect.objectContaining({ canonicalName: 'Ana' }),
    ]);
  });

  it('does not let a pre-mutation load overwrite the mutation reload', async () => {
    let resolveInitialLoad: (
      value: Awaited<ReturnType<typeof firestoreModule.getDocs>>,
    ) => void = () => undefined;
    const initialLoad = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>(
      (resolve) => {
        resolveInitialLoad = resolve;
      },
    );
    mockedGetDocs.mockReturnValueOnce(initialLoad).mockResolvedValueOnce({
      docs: [
        {
          id: 'client-doc-id',
          data: () => ({
            address: 'Rua Nova',
            currentUnitPrice: 55,
            name: 'Novo Cliente',
            normalizedName: 'novo-cliente',
          }),
        },
      ],
      metadata: { fromCache: false },
    } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);

    const dataSource = new FirestoreClientDataSource();
    dataSource.setSessionUser('uid-test', 1);
    const staleLoad = dataSource.load('uid-test', 1);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(mockedGetDocs).toHaveBeenCalledTimes(1);

    const mutation = dataSource.saveCustomClient('uid-test', 'Novo Cliente', 55, 'Rua Nova');
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(mockedSetDoc).toHaveBeenCalledTimes(1);
    expect(mockedGetDocs).toHaveBeenCalledTimes(2);

    await mutation;
    resolveInitialLoad({
      docs: [
        {
          id: 'old-client',
          data: () => ({
            address: 'Rua Antiga',
            currentUnitPrice: 40,
            name: 'Cliente Antigo',
            normalizedName: 'cliente-antigo',
          }),
        },
      ],
      metadata: { fromCache: false },
    } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);
    await staleLoad;

    expect(dataSource.list({}, 'uid-test', 1)).toEqual([
      expect.objectContaining({ canonicalName: 'Novo Cliente' }),
    ]);
  });
});
