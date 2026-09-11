import AsyncStorage from '@react-native-async-storage/async-storage';

import { FirestoreDeliveryCacheService } from '@/services/deliveries/FirestoreDeliveryCacheService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const delivery = {
  cliente: 'Ana',
  data: '2026-08-12',
  entregue: true,
  id: 'delivery-1',
  quantidade: 2,
  status: 'Não Pago' as const,
  valor: 110,
};

describe('FirestoreDeliveryCacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  });

  it('persists deliveries scoped to the user and date', async () => {
    const cache = new FirestoreDeliveryCacheService();

    await cache.write('uid-1', '2026-08-12', [delivery]);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'firestore-deliveries-cache-v1:uid-1:2026-08-12',
      expect.stringContaining('delivery-1'),
    );
  });

  it('returns only a valid cache for the requested date', async () => {
    const cache = new FirestoreDeliveryCacheService();
    jest
      .mocked(AsyncStorage.getItem)
      .mockResolvedValue(
        JSON.stringify({ date: '2026-08-12', deliveries: [delivery], savedAt: 1, version: 1 }),
      );

    await expect(cache.read('uid-1', '2026-08-12')).resolves.toEqual([delivery]);
    await expect(cache.read('uid-1', '2026-08-13')).resolves.toBeNull();
  });
});
