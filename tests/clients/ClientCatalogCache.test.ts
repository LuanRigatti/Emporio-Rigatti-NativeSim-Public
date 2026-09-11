import AsyncStorage from '@react-native-async-storage/async-storage';

import { ClientCatalogCache } from '@/services/clients/ClientCatalogCache';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const records = [
  {
    id: 'client-1',
    name: 'Ana',
    normalizedName: 'ana',
    address: 'Rua A',
    currentUnitPrice: 55,
  },
];

describe('ClientCatalogCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  });

  it('persists and reads the catalog by user', async () => {
    const cache = new ClientCatalogCache();
    await cache.write('uid-1', records);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@pareact/client-catalog-cache-v1:uid-1',
      expect.any(String),
    );

    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify({ cacheVersion: 1, records }),
    );
    await expect(cache.read('uid-1')).resolves.toEqual(records);
  });

  it('rejects malformed catalog data', async () => {
    const cache = new ClientCatalogCache();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify({ cacheVersion: 1, records: [{ id: 'missing-name' }] }),
    );

    await expect(cache.read('uid-1')).resolves.toBeNull();
  });
});
