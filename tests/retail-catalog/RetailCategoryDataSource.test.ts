import * as firestoreModule from 'firebase/firestore';

import {
  INITIAL_RETAIL_CATEGORIES,
  RetailCategoryDataSource,
  setFirestoreRetailCategoryDataSourceOpsForTesting,
} from '@/services/retail-catalog/RetailCategoryDataSource';

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
    id: typeof args.at(-1) === 'string' ? args.at(-1) : 'category-generated-id',
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
      id: String(record.categoryId ?? `category-${index + 1}`),
    })),
    metadata: { fromCache },
  } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>;
}

function record(id = 'category-1', overrides: Record<string, unknown> = {}) {
  return {
    active: true,
    categoryId: id,
    createdAt: { nanoseconds: 0, seconds: 1 },
    label: 'Cestas',
    normalizedLabel: 'cestas',
    sortOrder: 0,
    updatedAt: { nanoseconds: 0, seconds: 1 },
    ...overrides,
  };
}

describe('RetailCategoryDataSource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetDocs.mockReset();
    mockedSetDoc.mockReset().mockResolvedValue(undefined);
    mockedUpdateDoc.mockReset().mockResolvedValue(undefined);
    mockAsyncStorage = new Map();
    setFirestoreRetailCategoryDataSourceOpsForTesting(firestoreModule, {});
  });

  afterAll(() => setFirestoreRetailCategoryDataSourceOpsForTesting(undefined));

  it('reads only retailCategories and applies deterministic category ordering', async () => {
    mockedGetDocs.mockResolvedValueOnce(
      result([
        record('category-z', {
          label: 'Zeladoria',
          normalizedLabel: 'zeladoria',
          sortOrder: undefined,
        }),
        record('category-a', { label: 'Águas', normalizedLabel: 'aguas', sortOrder: undefined }),
      ]),
    );
    const dataSource = new RetailCategoryDataSource();
    dataSource.setSessionUser('uid-retail', 1);

    await dataSource.load('uid-retail', 1);

    expect(mockedCollection).toHaveBeenCalledWith({}, 'users', 'uid-retail', 'retailCategories');
    expect(dataSource.list({}, 'uid-retail', 1).map((category) => category.categoryId)).toEqual([
      'category-a',
      'category-z',
    ]);
  });

  it('creates, renames, and deactivates without deleting a category', async () => {
    mockedGetDocs.mockResolvedValueOnce(result());
    const dataSource = new RetailCategoryDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('uid-retail', 1);

    await dataSource.create('uid-retail', { label: 'Salgados', sortOrder: 1 }, 1);
    expect(mockedSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'category-generated-id' }),
      expect.objectContaining({ label: 'Salgados', normalizedLabel: 'salgados' }),
    );

    await dataSource.update('uid-retail', 'category-generated-id', { label: 'Doces' }, 1);
    expect(mockedUpdateDoc).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'category-generated-id' }),
      expect.objectContaining({ label: 'Doces', normalizedLabel: 'doces' }),
    );
    await dataSource.remove('uid-retail', 'category-generated-id', 1);
    expect(mockedUpdateDoc).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'category-generated-id' }),
      expect.objectContaining({ active: false }),
    );
  });

  it('normalizes duplicate labels and hides inactive categories by default', async () => {
    mockedGetDocs.mockResolvedValueOnce(
      result([record('category-1', { label: 'Águas', normalizedLabel: 'aguas' })]),
    );
    const dataSource = new RetailCategoryDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('uid-retail', 1);

    await expect(dataSource.create('uid-retail', { label: ' AGUAS ' }, 1)).rejects.toThrow(
      'Já existe',
    );
    expect(dataSource.list({}, 'uid-retail', 1)).toHaveLength(1);

    mockedGetDocs.mockResolvedValueOnce(
      result([record('category-1', { active: false, label: 'Águas', normalizedLabel: 'aguas' })]),
    );
    await dataSource.load('uid-retail', 1);
    expect(dataSource.list({}, 'uid-retail', 1)).toEqual([]);
    expect(dataSource.list({ includeInactive: true }, 'uid-retail', 1)).toHaveLength(1);
  });

  it('creates the initial categories only when explicitly requested', async () => {
    mockedGetDocs.mockResolvedValueOnce(result());
    const dataSource = new RetailCategoryDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('uid-retail', 1);
    expect(mockedSetDoc).not.toHaveBeenCalled();

    mockedGetDocs
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([record('category-generated-id', { label: 'Cestas' })]))
      .mockResolvedValueOnce(
        result([
          record('category-generated-id', { label: 'Cestas' }),
          record('category-generated-id-2', {
            label: 'Salgados',
            normalizedLabel: 'salgados',
            sortOrder: 1,
          }),
        ]),
      )
      .mockResolvedValueOnce(
        result(
          INITIAL_RETAIL_CATEGORIES.map((category, index) => record(`category-${index}`, category)),
        ),
      );

    await dataSource.ensureInitialCategories('uid-retail', 1);

    expect(mockedSetDoc).toHaveBeenCalledTimes(3);
    expect(
      mockedSetDoc.mock.calls
        .map((call) => call[1])
        .map((value) => (value as { label: string }).label),
    ).toEqual(['Cestas', 'Salgados', 'Baldes']);
  });

  it('discards a response that belongs to an older UID/session', async () => {
    let resolveLoad: (value: Awaited<ReturnType<typeof firestoreModule.getDocs>>) => void = () =>
      undefined;
    const pending = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>((resolve) => {
      resolveLoad = resolve;
    });
    mockedGetDocs.mockReturnValueOnce(pending);
    const dataSource = new RetailCategoryDataSource();
    dataSource.setSessionUser('uid-old', 1);
    const oldLoad = dataSource.load('uid-old', 1);
    await new Promise<void>((resolve) => setImmediate(resolve));
    dataSource.setSessionUser('uid-new', 2);
    resolveLoad(result([record('old-category')]));
    await oldLoad;

    expect(dataSource.getSnapshot('uid-old', 1)).toBeNull();
    expect(dataSource.getSnapshot('uid-new', 2)).toBeNull();
  });
});
