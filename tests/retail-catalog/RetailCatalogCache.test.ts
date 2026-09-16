import AsyncStorage from '@react-native-async-storage/async-storage';

import { RetailCategoryCatalogCache, RetailProductCatalogCache } from '@/services/retail-catalog';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

describe('Retail catalog caches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  });

  it('keeps category and product cache namespaces independent and UID scoped', async () => {
    const categoryCache = new RetailCategoryCatalogCache();
    const productCache = new RetailProductCatalogCache();
    await categoryCache.write('uid-1', []);
    await productCache.write('uid-1', []);

    expect(categoryCache.getKey('uid-1')).toBe('@pareact/retail-category-catalog-cache-v1:uid-1');
    expect(productCache.getKey('uid-1')).toBe('@pareact/retail-product-catalog-cache-v1:uid-1');
    expect(categoryCache.getKey('uid-1')).not.toBe(productCache.getKey('uid-1'));
  });

  it('rejects malformed records from both caches', async () => {
    const categoryCache = new RetailCategoryCatalogCache();
    const productCache = new RetailProductCatalogCache();
    jest
      .mocked(AsyncStorage.getItem)
      .mockResolvedValue(
        JSON.stringify({ cacheVersion: 1, records: [{ id: 'wholesale', name: 'Balde' }] }),
      );

    await expect(categoryCache.read('uid-1')).resolves.toBeNull();
    await expect(productCache.read('uid-1')).resolves.toBeNull();
  });
});
