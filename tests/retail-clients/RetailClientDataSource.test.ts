import * as firestoreModule from 'firebase/firestore';

import {
  RetailClientDataSource,
  setFirestoreRetailClientDataSourceOpsForTesting,
} from '@/services/retail-clients/RetailClientDataSource';

let mockAsyncStorage: Map<string, string>;

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockAsyncStorage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockAsyncStorage.set(key, value);
    }),
  },
}));

jest.mock('firebase/firestore', () => ({
  __esModule: true,
  collection: jest.fn((...args: unknown[]) => ({ path: args.join('/') })),
  deleteField: jest.fn(() => ({ type: 'deleteField' })),
  doc: jest.fn((...args: unknown[]) => ({
    id: typeof args.at(-1) === 'string' ? args.at(-1) : 'retail-generated-id',
    path: args.join('/'),
  })),
  getDocs: jest.fn(),
  serverTimestamp: jest.fn(() => ({ type: 'serverTimestamp' })),
  setDoc: jest.fn(async () => undefined),
  updateDoc: jest.fn(async () => undefined),
}));

const mockedCollection = jest.mocked(firestoreModule.collection);
const mockedDoc = jest.mocked(firestoreModule.doc);
const mockedGetDocs = jest.mocked(firestoreModule.getDocs);
const mockedSetDoc = jest.mocked(firestoreModule.setDoc);
const mockedUpdateDoc = jest.mocked(firestoreModule.updateDoc);

function result(
  records: readonly Record<string, unknown>[] = [],
  fromCache = false,
): Awaited<ReturnType<typeof firestoreModule.getDocs>> {
  return {
    docs: records.map((record, index) => ({
      data: () => record,
      id: String(record.clientId ?? `retail-${index + 1}`),
    })),
    metadata: { fromCache },
  } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>;
}

function record(id = 'retail-1', overrides: Record<string, unknown> = {}) {
  return {
    active: true,
    address: 'Rua A',
    clientId: id,
    createdAt: { nanoseconds: 0, seconds: 1 },
    defaultDeliveryFee: 0,
    name: 'Ana',
    normalizedName: 'ana',
    phone: '51999999999',
    updatedAt: { nanoseconds: 0, seconds: 1 },
    ...overrides,
  };
}

describe('RetailClientDataSource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage = new Map();
    setFirestoreRetailClientDataSourceOpsForTesting(firestoreModule, {});
  });

  afterAll(() => {
    setFirestoreRetailClientDataSourceOpsForTesting(undefined);
  });

  it('reads only the retailClients collection and preserves the retail model', async () => {
    mockedGetDocs.mockResolvedValueOnce(result([record()]));
    const dataSource = new RetailClientDataSource();
    dataSource.setSessionUser('uid-retail', 1);

    await dataSource.load('uid-retail', 1);

    expect(mockedCollection).toHaveBeenCalledWith({}, 'users', 'uid-retail', 'retailClients');
    expect(dataSource.list({}, 'uid-retail', 1)).toEqual([
      expect.objectContaining({
        clientId: 'retail-1',
        defaultDeliveryFee: 0,
        name: 'Ana',
        normalizedName: 'ana',
      }),
    ]);
  });

  it('sorts active clients by normalizedName with deterministic tie breakers', async () => {
    mockedGetDocs.mockResolvedValueOnce(
      result([
        record('retail-z', { name: 'Zélia', normalizedName: 'zelia' }),
        record('retail-a', { name: 'Ágata', normalizedName: 'agata' }),
      ]),
    );
    const dataSource = new RetailClientDataSource();
    dataSource.setSessionUser('uid-retail', 1);

    await dataSource.load('uid-retail', 1);

    expect(dataSource.list({}, 'uid-retail', 1).map((client) => client.clientId)).toEqual([
      'retail-a',
      'retail-z',
    ]);
  });

  it('creates a retail client with referral and a zero delivery default', async () => {
    mockedGetDocs
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([record('retail-generated-id')]));
    const dataSource = new RetailClientDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('uid-retail', 1);

    await dataSource.create(
      'uid-retail',
      {
        address: 'Rua B',
        defaultDeliveryFee: 0,
        name: 'Maria',
        referral: { hasReferral: true, referredByName: 'João', sourceType: 'cliente' },
      },
      1,
    );

    expect(mockedSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'retail-generated-id' }),
      expect.objectContaining({
        active: true,
        clientId: 'retail-generated-id',
        defaultDeliveryFee: 0,
        name: 'Maria',
        normalizedName: 'maria',
        referral: { hasReferral: true, referredByName: 'João', sourceType: 'cliente' },
      }),
    );
    expect(dataSource.list({}, 'uid-retail', 1)).toEqual([
      expect.objectContaining({ name: 'Ana' }),
    ]);
  });

  it('updates fields, allows zero, and deactivates without deleting the document', async () => {
    mockedGetDocs
      .mockResolvedValueOnce(result([record()]))
      .mockResolvedValueOnce(
        result([record('retail-1', { defaultDeliveryFee: 0, phone: undefined })]),
      )
      .mockResolvedValueOnce(result([record('retail-1', { active: false })]));
    const dataSource = new RetailClientDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('uid-retail', 1);

    await dataSource.update('uid-retail', 'retail-1', { defaultDeliveryFee: 0, phone: null }, 1);
    expect(mockedUpdateDoc).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'retail-1' }),
      expect.objectContaining({
        defaultDeliveryFee: 0,
        phone: { type: 'deleteField' },
      }),
    );

    await dataSource.remove('uid-retail', 'retail-1', 1);
    expect(mockedUpdateDoc).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'retail-1' }),
      expect.objectContaining({ active: false }),
    );
    expect(dataSource.list({}, 'uid-retail', 1)).toEqual([]);
    expect(dataSource.list({ includeInactive: true }, 'uid-retail', 1)).toEqual([
      expect.objectContaining({ active: false, clientId: 'retail-1' }),
    ]);
  });

  it('rejects a negative default delivery fee and duplicate active names', async () => {
    mockedGetDocs.mockResolvedValueOnce(result([record()]));
    const dataSource = new RetailClientDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('uid-retail', 1);

    await expect(
      dataSource.create('uid-retail', { defaultDeliveryFee: -1, name: 'Novo' }, 1),
    ).rejects.toThrow('zero ou maior');
    await expect(dataSource.create('uid-retail', { name: 'ANA' }, 1)).rejects.toThrow('Já existe');
  });

  it('does not publish a stale response after the UID/session changes', async () => {
    let resolveLoad: (value: Awaited<ReturnType<typeof firestoreModule.getDocs>>) => void = () =>
      undefined;
    const pending = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>((resolve) => {
      resolveLoad = resolve;
    });
    mockedGetDocs.mockReturnValueOnce(pending);
    const dataSource = new RetailClientDataSource();
    dataSource.setSessionUser('uid-old', 1);
    const oldLoad = dataSource.load('uid-old', 1);

    await new Promise<void>((resolve) => setImmediate(resolve));
    dataSource.setSessionUser('uid-new', 2);
    resolveLoad(result([record('old-client')]));
    await oldLoad;

    expect(dataSource.getSnapshot('uid-old', 1)).toBeNull();
    expect(dataSource.getSnapshot('uid-new', 2)).toBeNull();
    expect(dataSource.list({}, 'uid-new', 2)).toEqual([]);
  });

  it('invalidates an in-flight response when the same UID receives a new session version', async () => {
    let resolveLoad: (value: Awaited<ReturnType<typeof firestoreModule.getDocs>>) => void = () =>
      undefined;
    const pending = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>((resolve) => {
      resolveLoad = resolve;
    });
    mockedGetDocs.mockReturnValueOnce(pending);
    const dataSource = new RetailClientDataSource();
    dataSource.setSessionUser('uid-same', 1);
    const oldLoad = dataSource.load('uid-same', 1);

    await new Promise<void>((resolve) => setImmediate(resolve));
    dataSource.setSessionUser('uid-same', 2);
    resolveLoad(result([record('old-session-client')]));
    await oldLoad;

    expect(dataSource.getSnapshot('uid-same', 1)).toBeNull();
    expect(dataSource.getSnapshot('uid-same', 2)).toBeNull();
    expect(dataSource.list({}, 'uid-same', 2)).toEqual([]);
  });

  it('keeps retail identity separate from the wholesale clients collection', async () => {
    mockedGetDocs.mockResolvedValueOnce(result([record('same-name-retail')]));
    const dataSource = new RetailClientDataSource();
    dataSource.setSessionUser('uid-same', 1);
    await dataSource.load('uid-same', 1);

    expect(dataSource.list({}, 'uid-same', 1)[0]?.name).toBe('Ana');
    expect(mockedCollection).toHaveBeenCalledWith({}, 'users', 'uid-same', 'retailClients');
    expect(mockedCollection.mock.calls.some((call) => call[3] === 'clients')).toBe(false);
    expect(mockedDoc).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('clients'),
    );
  });
});
