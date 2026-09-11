import AsyncStorage from '@react-native-async-storage/async-storage';

import { StockPeriodSnapshotCache } from '@/services/stock/StockPeriodSnapshotCache';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const summary = {
  deliveredBuckets: 2,
  endingBuckets: 8,
  openingBuckets: 5,
  purchasedBuckets: 5,
};

describe('StockPeriodSnapshotCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  });

  it('persists and reads a snapshot by user and period', async () => {
    const cache = new StockPeriodSnapshotCache();
    await cache.write('uid-1', '2026-08', summary, 49.8, 398.4);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@pareact/stock-period-cache-v1:uid-1:2026-08',
      expect.any(String),
    );

    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify({
        cacheVersion: 1,
        uid: 'uid-1',
        period: '2026-08',
        summary,
        bucketCost: 49.8,
        stockValue: 398.4,
        cachedAt: 1,
      }),
    );

    await expect(cache.read('uid-1', '2026-08')).resolves.toMatchObject({
      period: '2026-08',
      stockValue: 398.4,
    });
  });

  it('rejects a snapshot from another period', async () => {
    const cache = new StockPeriodSnapshotCache();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify({
        cacheVersion: 1,
        uid: 'uid-1',
        period: '2026-07',
        summary,
        bucketCost: 49.8,
        stockValue: 398.4,
        cachedAt: 1,
      }),
    );

    await expect(cache.read('uid-1', '2026-08')).resolves.toBeNull();
  });
});
