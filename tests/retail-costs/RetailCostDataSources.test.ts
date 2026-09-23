import * as firestoreModule from 'firebase/firestore';

import {
  RetailCompositionDataSource,
  RetailCostEntryCatalogCache,
  RetailCostEntryDataSource,
  retailCostEntryCatalogCache,
  RetailCostItemDataSource,
  RetailCostItemCatalogCache,
  getRetailCompositionComponentIdIssues,
  setFirestoreRetailCompositionDataSourceOpsForTesting,
  setFirestoreRetailCostEntryDataSourceOpsForTesting,
  setFirestoreRetailCostItemDataSourceOpsForTesting,
} from '@/services/retail-costs';

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
    id: typeof args.at(-1) === 'string' ? args.at(-1) : 'generated-id',
    path: args.join('/'),
  })),
  getDocs: jest.fn(),
  serverTimestamp: jest.fn(() => ({ type: 'serverTimestamp' })),
  setDoc: jest.fn(async () => undefined),
  updateDoc: jest.fn(async () => undefined),
}));

const mockedCollection = jest.mocked(firestoreModule.collection);
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
      id: String(record.id ?? record.costItemId ?? record.entryId ?? `record-${index + 1}`),
    })),
    metadata: { fromCache },
  } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>;
}

function costItemRecord(id = 'coffee', overrides: Record<string, unknown> = {}) {
  return {
    active: true,
    costItemId: id,
    createdAt: { nanoseconds: 0, seconds: 1 },
    name: 'Café',
    normalizedName: 'cafe',
    unit: 'unidade',
    updatedAt: { nanoseconds: 0, seconds: 1 },
    ...overrides,
  };
}

describe('retail cost data sources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetDocs.mockReset();
    mockedSetDoc.mockReset().mockResolvedValue(undefined);
    mockedUpdateDoc.mockReset().mockResolvedValue(undefined);
    mockAsyncStorage = new Map();
    setFirestoreRetailCostItemDataSourceOpsForTesting(firestoreModule, {});
    setFirestoreRetailCostEntryDataSourceOpsForTesting(firestoreModule, {});
    setFirestoreRetailCompositionDataSourceOpsForTesting(firestoreModule, {});
  });

  afterAll(() => {
    setFirestoreRetailCostItemDataSourceOpsForTesting(undefined);
    setFirestoreRetailCostEntryDataSourceOpsForTesting(undefined);
    setFirestoreRetailCompositionDataSourceOpsForTesting(undefined);
  });

  it('detects empty, whitespace-only, and duplicate composition item ids', () => {
    expect(
      getRetailCompositionComponentIdIssues([
        { costItemId: ' ' },
        { costItemId: 'coffee' },
        { costItemId: ' coffee ' },
      ]),
    ).toEqual({ duplicateIds: ['coffee'], emptyIndexes: [0] });
  });

  it('keeps legacy empty ids readable but rejects them when writing a new version', async () => {
    mockedGetDocs.mockResolvedValueOnce(
      result([
        {
          active: true,
          components: [
            { costItemId: '', costItemNameSnapshot: 'Café antigo', quantity: 1, unit: 'kg' },
          ],
          effectiveFrom: '2026-01-01',
          id: 'legacy-composition',
          productId: 'product-1',
        },
      ]),
    );
    const dataSource = new RetailCompositionDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('product-1', 'uid-retail', 1);

    expect(dataSource.list('product-1', 'uid-retail', 1)[0]?.components[0]).toMatchObject({
      costItemId: '',
      costItemNameSnapshot: 'Café antigo',
    });
    await expect(
      dataSource.createVersion(
        'uid-retail',
        'product-1',
        {
          components: [
            { costItemId: ' ', costItemNameSnapshot: 'Café antigo', quantity: 1, unit: 'kg' },
          ],
          effectiveFrom: '2026-01-01',
        },
        new Map([['coffee', { costItemId: 'coffee', name: 'Café', unit: 'kg' }]]),
        1,
      ),
    ).rejects.toThrow('Selecione um item de custo');
  });

  it('creates, updates, and soft-deactivates items in the retail namespace', async () => {
    mockedGetDocs.mockResolvedValueOnce(result());
    const dataSource = new RetailCostItemDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('uid-retail', 1);

    await dataSource.create('uid-retail', { name: 'Café', unit: 'unidade' }, 1);
    expect(mockedCollection).toHaveBeenCalledWith({}, 'users', 'uid-retail', 'retailCostItems');
    expect(mockedSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'generated-id' }),
      expect.objectContaining({ name: 'Café', normalizedName: 'cafe', unit: 'unidade' }),
    );

    await dataSource.update('uid-retail', 'generated-id', { name: 'Café em pó' }, 1);
    await dataSource.remove('uid-retail', 'generated-id', 1);

    expect(mockedUpdateDoc).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'generated-id' }),
      expect.objectContaining({ name: 'Café em pó', normalizedName: 'cafe em po' }),
    );
    expect(mockedUpdateDoc).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'generated-id' }),
      expect.objectContaining({ active: false }),
    );
    expect(dataSource.list({}, 'uid-retail', 1)).toEqual([]);
    expect(dataSource.list({ includeInactive: true }, 'uid-retail', 1)).toEqual([
      expect.objectContaining({ active: false }),
    ]);
  });

  it('keeps the base unit immutable and rejects invalid or duplicate cost items', async () => {
    mockedGetDocs.mockResolvedValueOnce(result([costItemRecord()]));
    const dataSource = new RetailCostItemDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('uid-retail', 1);

    await expect(
      dataSource.create('uid-retail', { name: ' café ', unit: 'kg' }, 1),
    ).rejects.toThrow('Já existe');
    await expect(dataSource.update('uid-retail', 'coffee', { unit: 'kg' }, 1)).rejects.toThrow(
      'unidade-base',
    );
    await expect(
      dataSource.create('uid-retail', { name: 'Açúcar', unit: 'unidade' }, 1),
    ).resolves.toBeUndefined();
  });

  it('writes additive entries with a normalized unit cost and nested path', async () => {
    mockedGetDocs.mockResolvedValueOnce(result([]));
    const dataSource = new RetailCostEntryDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('coffee', 'uid-retail', 1);
    const listener = jest.fn();
    dataSource.subscribe(listener);

    await dataSource.create(
      'uid-retail',
      'coffee',
      'unidade',
      {
        effectiveDate: '2026-01-01',
        purchaseTotalCost: 10,
        purchasedQuantity: 4,
        supplier: 'Fornecedor',
      },
      1,
    );

    expect(mockedCollection).toHaveBeenCalledWith(
      {},
      'users',
      'uid-retail',
      'retailCostItems',
      'coffee',
      'costEntries',
    );
    expect(mockedSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'generated-id' }),
      expect.objectContaining({
        effectiveDate: '2026-01-01',
        normalizedUnitCost: 2.5,
        purchaseTotalCost: 10,
        purchasedQuantity: 4,
        unit: 'unidade',
      }),
    );
    expect(dataSource.list('coffee', 'uid-retail', 1)[0]).toMatchObject({
      normalizedUnitCost: 2.5,
    });
    expect(listener).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    await expect(retailCostEntryCatalogCache.read('uid-retail', 'coffee')).resolves.toEqual([
      expect.objectContaining({ id: 'generated-id', normalizedUnitCost: 2.5 }),
    ]);
  });

  it('updates only an existing entry effective date and preserves its normalized cost data', async () => {
    mockedGetDocs.mockResolvedValueOnce(
      result([
        {
          createdAt: { nanoseconds: 0, seconds: 1 },
          effectiveDate: '2026-09-20',
          entryId: 'entry-1',
          id: 'entry-1',
          normalizedUnitCost: 2.5,
          purchaseTotalCost: 10,
          purchasedQuantity: 4,
          supplier: 'Fornecedor',
          unit: 'unidade',
        },
      ]),
    );
    const dataSource = new RetailCostEntryDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('coffee', 'uid-retail', 1);
    const listener = jest.fn();
    dataSource.subscribe(listener);

    await dataSource.updateEffectiveDate('uid-retail', 'coffee', 'entry-1', '2026-09-10', 1);

    expect(mockedUpdateDoc).toHaveBeenCalledWith(expect.objectContaining({ id: 'entry-1' }), {
      effectiveDate: '2026-09-10',
    });
    expect(dataSource.list('coffee', 'uid-retail', 1)[0]).toMatchObject({
      effectiveDate: '2026-09-10',
      entryId: 'entry-1',
      normalizedUnitCost: 2.5,
      purchaseTotalCost: 10,
      purchasedQuantity: 4,
      supplier: 'Fornecedor',
      unit: 'unidade',
    });
    expect(mockedSetDoc).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    await expect(retailCostEntryCatalogCache.read('uid-retail', 'coffee')).resolves.toEqual([
      expect.objectContaining({
        effectiveDate: '2026-09-10',
        id: 'entry-1',
        normalizedUnitCost: 2.5,
      }),
    ]);
  });

  it('publishes cached cost entries before its remote refresh resolves', async () => {
    const cache = new RetailCostEntryCatalogCache();
    await cache.write('uid-retail', 'coffee', [
      {
        effectiveDate: '2026-09-20',
        entryId: 'cached-entry',
        id: 'cached-entry',
        normalizedUnitCost: 2.5,
        purchaseTotalCost: 10,
        purchasedQuantity: 4,
        unit: 'unidade',
      },
    ]);
    let resolveRemote: (value: Awaited<ReturnType<typeof firestoreModule.getDocs>>) => void = () =>
      undefined;
    mockedGetDocs.mockReturnValueOnce(
      new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>((resolve) => {
        resolveRemote = resolve;
      }),
    );
    const dataSource = new RetailCostEntryDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    const load = dataSource.load('coffee', 'uid-retail', 1);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(dataSource.list('coffee', 'uid-retail', 1)).toEqual([
      expect.objectContaining({ entryId: 'cached-entry', normalizedUnitCost: 2.5 }),
    ]);

    resolveRemote(
      result([
        {
          effectiveDate: '2026-09-21',
          entryId: 'remote-entry',
          id: 'remote-entry',
          normalizedUnitCost: 3,
          purchaseTotalCost: 12,
          purchasedQuantity: 4,
          unit: 'unidade',
        },
      ]),
    );
    await load;

    expect(dataSource.list('coffee', 'uid-retail', 1)).toEqual([
      expect.objectContaining({ entryId: 'remote-entry', normalizedUnitCost: 3 }),
    ]);
  });

  it('rejects invalid quantities, negative costs, and unit mismatches', async () => {
    mockedGetDocs.mockResolvedValueOnce(result([]));
    const dataSource = new RetailCostEntryDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('coffee', 'uid-retail', 1);

    await expect(
      dataSource.create(
        'uid-retail',
        'coffee',
        'kg',
        {
          effectiveDate: '2026-01-01',
          purchaseTotalCost: 1,
          purchasedQuantity: 1,
          unit: 'unidade',
        },
        1,
      ),
    ).rejects.toThrow('unidade-base');
    await expect(
      dataSource.create(
        'uid-retail',
        'coffee',
        'unidade',
        { effectiveDate: '2026-01-01', purchaseTotalCost: -1, purchasedQuantity: 1 },
        1,
      ),
    ).rejects.toThrow('zero ou maior');
    await expect(
      dataSource.create(
        'uid-retail',
        'coffee',
        'unidade',
        { effectiveDate: '2026-01-01', purchaseTotalCost: 1, purchasedQuantity: 0 },
        1,
      ),
    ).rejects.toThrow('maior que zero');
  });

  it('creates immutable composition versions with component snapshots', async () => {
    mockedGetDocs.mockResolvedValueOnce(result([]));
    const dataSource = new RetailCompositionDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('product-1', 'uid-retail', 1);

    const versionId = await dataSource.createVersion(
      'uid-retail',
      'product-1',
      {
        components: [
          {
            costItemId: 'coffee',
            costItemNameSnapshot: 'Nome antigo',
            quantity: 2,
            unit: 'unidade',
          },
        ],
        effectiveFrom: '2026-01-01',
      },
      new Map([['coffee', { costItemId: 'coffee', name: 'Café', unit: 'unidade' }]]),
      1,
    );

    expect(versionId).toBe('generated-id');
    expect(mockedCollection).toHaveBeenCalledWith(
      {},
      'users',
      'uid-retail',
      'retailProducts',
      'product-1',
      'compositionVersions',
    );
    expect(mockedSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'generated-id' }),
      expect.objectContaining({
        components: [
          expect.objectContaining({ costItemNameSnapshot: 'Café', quantity: 2, unit: 'unidade' }),
        ],
        effectiveFrom: '2026-01-01',
        productId: 'product-1',
      }),
    );
  });

  it('discards an old UID response after the retail session changes', async () => {
    let resolveLoad: (value: Awaited<ReturnType<typeof firestoreModule.getDocs>>) => void = () =>
      undefined;
    const pending = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>((resolve) => {
      resolveLoad = resolve;
    });
    mockedGetDocs.mockReturnValueOnce(pending);
    const dataSource = new RetailCostItemDataSource();
    dataSource.setSessionUser('uid-old', 1);
    const oldLoad = dataSource.load('uid-old', 1);
    await new Promise<void>((resolve) => setImmediate(resolve));
    dataSource.setSessionUser('uid-new', 2);
    resolveLoad(result([costItemRecord('old')]));
    await oldLoad;

    expect(dataSource.getSnapshot('uid-old', 1)).toBeNull();
    expect(dataSource.getSnapshot('uid-new', 2)).toBeNull();
  });

  it('discards an old session-version response for the same UID', async () => {
    let resolveLoad: (value: Awaited<ReturnType<typeof firestoreModule.getDocs>>) => void = () =>
      undefined;
    const pending = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>((resolve) => {
      resolveLoad = resolve;
    });
    mockedGetDocs.mockReturnValueOnce(pending);
    const dataSource = new RetailCostItemDataSource();
    dataSource.setSessionUser('uid-same', 1);
    const oldLoad = dataSource.load('uid-same', 1);
    await new Promise<void>((resolve) => setImmediate(resolve));
    dataSource.setSessionUser('uid-same', 2);
    resolveLoad(result([costItemRecord('old-session')]));
    await oldLoad;

    expect(dataSource.getSnapshot('uid-same', 1)).toBeNull();
    expect(dataSource.getSnapshot('uid-same', 2)).toBeNull();
  });

  it('does not let an old read overwrite a mutation result', async () => {
    mockedGetDocs.mockResolvedValueOnce(result([costItemRecord('coffee')]));
    const dataSource = new RetailCostItemDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('uid-retail', 1);

    let resolveStaleRead: (
      value: Awaited<ReturnType<typeof firestoreModule.getDocs>>,
    ) => void = () => undefined;
    const staleRead = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>(
      (resolve) => {
        resolveStaleRead = resolve;
      },
    );
    mockedGetDocs.mockReturnValueOnce(staleRead);
    const oldLoad = dataSource.load('uid-retail', 1);
    await new Promise<void>((resolve) => setImmediate(resolve));

    await dataSource.update('uid-retail', 'coffee', { name: 'Café atualizado' }, 1);
    resolveStaleRead(result([costItemRecord('coffee', { name: 'Café antigo' })]));
    await oldLoad;

    expect(dataSource.getById('coffee', 'uid-retail', 1)?.name).toBe('Café atualizado');
  });

  it('publishes a confirmed create without depending on a failed remote reload', async () => {
    mockedGetDocs.mockResolvedValueOnce(result());
    const dataSource = new RetailCostItemDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('uid-retail', 1);

    mockedGetDocs.mockRejectedValueOnce(new Error('Refresh indisponível'));

    await expect(
      dataSource.create('uid-retail', { name: 'Café', unit: 'unidade' }, 1),
    ).resolves.toBeUndefined();
    expect(dataSource.getById('generated-id', 'uid-retail', 1)).toEqual(
      expect.objectContaining({ name: 'Café', unit: 'unidade' }),
    );
    expect(mockedGetDocs).toHaveBeenCalledTimes(1);
  });

  it('exposes a valid cached catalog while the remote refresh is pending', async () => {
    const cachedItem = {
      active: true,
      id: 'cached-coffee',
      name: 'Café em cache',
      normalizedName: 'cafe em cache',
      unit: 'unidade',
    };
    const cache = new RetailCostItemCatalogCache();
    await cache.write('uid-retail', [cachedItem]);
    let resolveRemote: (value: Awaited<ReturnType<typeof firestoreModule.getDocs>>) => void = () =>
      undefined;
    mockedGetDocs.mockReturnValueOnce(
      new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>((resolve) => {
        resolveRemote = resolve;
      }),
    );
    const dataSource = new RetailCostItemDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    const load = dataSource.load('uid-retail', 1);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(dataSource.list({}, 'uid-retail', 1)).toEqual([
      expect.objectContaining({ costItemId: 'cached-coffee', name: 'Café em cache' }),
    ]);
    resolveRemote(result([]));
    await load;
  });

  it('keeps the local cost-item cache isolated by UID', async () => {
    const cache = new RetailCostItemCatalogCache();
    await cache.write('uid-a', [
      {
        active: true,
        id: 'coffee',
        name: 'Café',
        normalizedName: 'cafe',
        unit: 'unidade',
      },
    ]);

    await expect(cache.read('uid-a')).resolves.toEqual([
      expect.objectContaining({ id: 'coffee', name: 'Café' }),
    ]);
    await expect(cache.read('uid-b')).resolves.toBeNull();
    expect(cache.getKey('uid-a')).not.toBe(cache.getKey('uid-b'));
  });
});
