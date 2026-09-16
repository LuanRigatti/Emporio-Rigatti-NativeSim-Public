import * as firestoreModule from 'firebase/firestore';

import {
  RetailProductDataSource,
  setFirestoreRetailProductDataSourceOpsForTesting,
} from '@/services/retail-catalog/RetailProductDataSource';
import { RetailProductCatalogCache } from '@/services/retail-catalog/RetailProductCatalogCache';

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
    id: typeof args.at(-1) === 'string' ? args.at(-1) : 'product-generated-id',
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
): Awaited<ReturnType<typeof firestoreModule.getDocs>> {
  return {
    docs: records.map((record, index) => ({
      data: () => record,
      id: String(record.productId ?? `product-${index + 1}`),
    })),
    metadata: { fromCache: false },
  } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>;
}

function record(id = 'product-1', overrides: Record<string, unknown> = {}) {
  return {
    active: true,
    categoryId: 'cestas',
    categoryName: 'Cestas',
    createdAt: { nanoseconds: 0, seconds: 1 },
    flavor: 'Chocolate',
    packageSize: '10 unidades',
    productId: id,
    productName: 'Cesta Café Portugal',
    standardSalePrice: 0,
    updatedAt: { nanoseconds: 0, seconds: 1 },
    ...overrides,
  };
}

describe('RetailProductDataSource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetDocs.mockReset();
    mockedSetDoc.mockReset().mockResolvedValue(undefined);
    mockedUpdateDoc.mockReset().mockResolvedValue(undefined);
    mockAsyncStorage = new Map();
    setFirestoreRetailProductDataSourceOpsForTesting(firestoreModule, {});
  });

  afterAll(() => setFirestoreRetailProductDataSourceOpsForTesting(undefined));

  it('uses retailProducts, permits zero price, and keeps product identity independent', async () => {
    mockedGetDocs.mockResolvedValueOnce(
      result([
        record('product-b', {
          categoryId: 'salgados',
          categoryName: 'Salgados',
          productName: 'Cesta Café Portugal',
        }),
        record('product-a', { categoryId: 'cestas', productName: 'Cesta Café Portugal' }),
      ]),
    );
    const dataSource = new RetailProductDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('uid-retail', 1);

    expect(mockedCollection).toHaveBeenCalledWith({}, 'users', 'uid-retail', 'retailProducts');
    expect(dataSource.list({}, 'uid-retail', 1).map((product) => product.productId)).toEqual([
      'product-a',
      'product-b',
    ]);
    expect(dataSource.list({ categoryId: 'salgados' }, 'uid-retail', 1)[0]?.productName).toBe(
      'Cesta Café Portugal',
    );
  });

  it('creates, edits, searches, and deactivates a product without affecting wholesale', async () => {
    mockedGetDocs.mockResolvedValueOnce(result());
    const dataSource = new RetailProductDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('uid-retail', 1);

    await dataSource.create(
      'uid-retail',
      {
        categoryId: 'salgados',
        categoryName: 'Salgados',
        productName: 'Croissant Frango',
        standardSalePrice: 0,
      },
      1,
    );
    expect(mockedSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'product-generated-id' }),
      expect.objectContaining({ standardSalePrice: 0, productName: 'Croissant Frango' }),
    );
    await dataSource.update(
      'uid-retail',
      'product-generated-id',
      { flavor: 'Chocolate', productName: 'Croissant Chocolate', standardSalePrice: 12.5 },
      1,
    );
    expect(mockedUpdateDoc).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'product-generated-id' }),
      expect.objectContaining({ productName: 'Croissant Chocolate', standardSalePrice: 12.5 }),
    );
    await dataSource.remove('uid-retail', 'product-generated-id', 1);
    expect(dataSource.list({}, 'uid-retail', 1)).toEqual([]);
    expect(dataSource.list({ includeInactive: true }, 'uid-retail', 1)).toEqual([
      expect.objectContaining({ active: false }),
    ]);
  });

  it('rejects missing category/name and negative prices', async () => {
    mockedGetDocs.mockResolvedValueOnce(result());
    const dataSource = new RetailProductDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('uid-retail', 1);

    await expect(
      dataSource.create(
        'uid-retail',
        { categoryId: '', productName: 'Produto', standardSalePrice: 1 },
        1,
      ),
    ).rejects.toThrow('categoria');
    await expect(
      dataSource.create(
        'uid-retail',
        { categoryId: 'cestas', productName: 'Produto', standardSalePrice: -1 },
        1,
      ),
    ).rejects.toThrow('zero ou maior');
  });

  it('publishes a confirmed create without depending on a failed remote reload', async () => {
    mockedGetDocs.mockResolvedValueOnce(result());
    const dataSource = new RetailProductDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    await dataSource.load('uid-retail', 1);
    mockedGetDocs.mockRejectedValueOnce(new Error('Refresh indisponível'));

    await expect(
      dataSource.create(
        'uid-retail',
        { categoryId: 'cestas', productName: 'Cesta Café', standardSalePrice: 10 },
        1,
      ),
    ).resolves.toBeUndefined();
    expect(dataSource.getById('product-generated-id', 'uid-retail', 1)).toEqual(
      expect.objectContaining({ productName: 'Cesta Café' }),
    );
    expect(mockedGetDocs).toHaveBeenCalledTimes(1);
  });

  it('exposes a valid cached catalog while the remote refresh is pending', async () => {
    const cache = new RetailProductCatalogCache();
    await cache.write('uid-retail', [
      {
        active: true,
        categoryId: 'cestas',
        id: 'cached-product',
        productName: 'Cesta em cache',
        standardSalePrice: 10,
      },
    ]);
    let resolveRemote: (value: Awaited<ReturnType<typeof firestoreModule.getDocs>>) => void = () =>
      undefined;
    mockedGetDocs.mockReturnValueOnce(
      new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>((resolve) => {
        resolveRemote = resolve;
      }),
    );
    const dataSource = new RetailProductDataSource();
    dataSource.setSessionUser('uid-retail', 1);
    const load = dataSource.load('uid-retail', 1);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(dataSource.list({}, 'uid-retail', 1)).toEqual([
      expect.objectContaining({ productId: 'cached-product', productName: 'Cesta em cache' }),
    ]);
    resolveRemote(result([]));
    await load;
  });

  it('discards a response that belongs to an older session version', async () => {
    let resolveLoad: (value: Awaited<ReturnType<typeof firestoreModule.getDocs>>) => void = () =>
      undefined;
    const pending = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>((resolve) => {
      resolveLoad = resolve;
    });
    mockedGetDocs.mockReturnValueOnce(pending);
    const dataSource = new RetailProductDataSource();
    dataSource.setSessionUser('uid-same', 1);
    const oldLoad = dataSource.load('uid-same', 1);
    await new Promise<void>((resolve) => setImmediate(resolve));
    dataSource.setSessionUser('uid-same', 2);
    resolveLoad(result([record('old-product')]));
    await oldLoad;

    expect(dataSource.getSnapshot('uid-same', 1)).toBeNull();
    expect(dataSource.getSnapshot('uid-same', 2)).toBeNull();
  });
});
