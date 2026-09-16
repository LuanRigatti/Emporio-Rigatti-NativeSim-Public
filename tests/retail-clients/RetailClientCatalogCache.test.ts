import AsyncStorage from '@react-native-async-storage/async-storage';

import { RetailClientCatalogCache } from '@/services/retail-clients/RetailClientCatalogCache';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const records = [
  {
    active: true,
    id: 'retail-1',
    name: 'Ana',
    normalizedName: 'ana',
  },
];

describe('RetailClientCatalogCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  });

  it('uses a retail-only, UID-scoped cache key', async () => {
    const cache = new RetailClientCatalogCache();
    await cache.write('uid-1', records);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@pareact/retail-client-catalog-cache-v1:uid-1',
      expect.any(String),
    );
    expect(cache.getKey('uid-1')).not.toBe('@pareact/client-catalog-cache-v1:uid-1');
  });

  it('rejects malformed or wholesale-shaped cache records', async () => {
    const cache = new RetailClientCatalogCache();
    jest
      .mocked(AsyncStorage.getItem)
      .mockResolvedValue(
        JSON.stringify({ cacheVersion: 1, records: [{ id: 'wholesale-1', name: 'Ana' }] }),
      );

    await expect(cache.read('uid-1')).resolves.toBeNull();
  });
});
