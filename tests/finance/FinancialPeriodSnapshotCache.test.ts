import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  FinancialPeriodSnapshotCache,
  type FinancialPeriodSnapshotCacheEntry,
} from '@/services/finance/FinancialPeriodSnapshotCache';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  removeItem: jest.fn(),
  setItem: jest.fn(),
}));

const snapshot = {
  clientesCustom: {},
  entregas: [],
  gastosDiarios: {},
  gastosMensais: {},
  recebimentoBaldes: [],
};

describe('FinancialPeriodSnapshotCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    jest.mocked(AsyncStorage.removeItem).mockResolvedValue(undefined);
    jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  });

  it('persists and reads only the exact uid and display month', async () => {
    const cache = new FinancialPeriodSnapshotCache();
    const entry: FinancialPeriodSnapshotCacheEntry = {
      cacheVersion: 1,
      uid: 'uid-1',
      displayMonth: '2026-08',
      snapshot,
      comparisonSnapshot: snapshot,
      cachedAt: 1,
    };

    await cache.write('uid-1', '2026-08', snapshot, snapshot);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@pareact/financial-period-cache-v1:uid-1:2026-08',
      expect.any(String),
    );

    jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(entry));
    const result = await cache.read('uid-1', '2026-08');

    expect(result).toMatchObject({ uid: 'uid-1', displayMonth: '2026-08' });
    expect(await cache.read('uid-1', '2026-07')).toBeNull();
  });

  it('rejects malformed or mismatched entries instead of showing another period', async () => {
    const cache = new FinancialPeriodSnapshotCache();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify({
        cacheVersion: 1,
        uid: 'other-user',
        displayMonth: '2026-07',
        snapshot,
        comparisonSnapshot: snapshot,
        cachedAt: 1,
      }),
    );

    expect(await cache.read('uid-1', '2026-08')).toBeNull();
  });

  it('invalidates the in-memory and persisted snapshot for one month', async () => {
    const cache = new FinancialPeriodSnapshotCache();
    await cache.write('uid-1', '2026-08', snapshot, snapshot);

    await cache.invalidate('uid-1', '2026-08');

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      '@pareact/financial-period-cache-v1:uid-1:2026-08',
    );
    expect(cache.getMemory('uid-1', '2026-08')).toBeNull();
  });
});
