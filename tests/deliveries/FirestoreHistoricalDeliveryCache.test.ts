import AsyncStorage from '@react-native-async-storage/async-storage';

import { FirestoreHistoricalDeliveryCache } from '@/services/deliveries/FirestoreHistoricalDeliveryCache';
import type { Delivery } from '@/types/data';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const deliveryA: Delivery = {
  id: 'del-1',
  clientId: 'client:andre',
  cliente: 'André',
  data: '2025-08-12',
  entregue: true,
  quantidade: 2,
  status: 'Pago',
  valor: 100,
};

const deliveryB: Delivery = {
  id: 'del-2',
  clientId: 'client:luciano',
  cliente: 'Luciano',
  data: '2026-08-14',
  entregue: true,
  quantidade: 5,
  status: 'Pago',
  valor: 250,
};

describe('FirestoreHistoricalDeliveryCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
    jest.mocked(AsyncStorage.removeItem).mockResolvedValue(undefined);
  });

  it('persists complete historical deliveries scoped strictly by user id', async () => {
    const cache = new FirestoreHistoricalDeliveryCache();

    await cache.write('user-123', [deliveryA, deliveryB]);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@pareact/historical-deliveries-cache-v1:user-123',
      expect.stringContaining('del-1'),
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@pareact/historical-deliveries-cache-v1:user-123',
      expect.stringContaining('del-2'),
    );
  });

  it('reads from memory cache on subsequent calls without reading AsyncStorage again', async () => {
    const cache = new FirestoreHistoricalDeliveryCache();

    await cache.write('user-123', [deliveryA, deliveryB]);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);

    const result = await cache.read('user-123');
    expect(result).toEqual([deliveryA, deliveryB]);
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  });

  it('reads from AsyncStorage when memory cache is empty and populates memory cache', async () => {
    const cache = new FirestoreHistoricalDeliveryCache();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify({
        cacheVersion: 1,
        savedAt: Date.now(),
        deliveries: [deliveryA, deliveryB],
      }),
    );

    const firstRead = await cache.read('user-abc');
    expect(firstRead).toEqual([deliveryA, deliveryB]);
    expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);

    const secondRead = await cache.read('user-abc');
    expect(secondRead).toEqual([deliveryA, deliveryB]);
    expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
  });

  it('invalidates cache in memory and in AsyncStorage on mutations', async () => {
    const cache = new FirestoreHistoricalDeliveryCache();
    await cache.write('user-123', [deliveryA]);

    await cache.invalidate('user-123');

    expect(cache.getMemory('user-123')).toBeNull();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      '@pareact/historical-deliveries-cache-v1:user-123',
    );
  });

  it('isolates cache completely between different users', async () => {
    const cache = new FirestoreHistoricalDeliveryCache();
    await cache.write('user-1', [deliveryA]);
    await cache.write('user-2', [deliveryB]);

    expect(cache.getMemory('user-1')).toEqual([deliveryA]);
    expect(cache.getMemory('user-2')).toEqual([deliveryB]);
    expect(cache.getMemory('user-3')).toBeNull();
  });
});
