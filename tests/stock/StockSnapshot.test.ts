import { mapStockSnapshots, toFirebaseStockSnapshots } from '@/mappers/firebase';
import { mockStockSnapshotRepository } from '@/repositories/MockStockSnapshotRepository';
import { stockCalculationService } from '@/services/stock/StockCalculationService';
import { FirebaseStockSnapshotRepository } from '@/repositories/FirebaseStockSnapshotRepository';
import { ENABLE_FIREBASE_WRITES } from '@/config/featureFlags';
import type { StockSnapshotMap } from '@/types/data';

jest.mock('firebase/database', () => ({
  get: jest.fn(),
  ref: jest.fn(),
  set: jest.fn(),
}));
jest.mock('@/services/firebase', () => ({
  getFirebaseDatabase: jest.fn(),
}));

describe('StockSnapshot', () => {
  beforeEach(async () => {
    await mockStockSnapshotRepository.replaceAll({});
  });

  it('materializes only the calculated period summary', () => {
    const snapshot = stockCalculationService.createSnapshot(
      '2026-08',
      {
        deliveredBuckets: 70,
        endingBuckets: 30,
        openingBuckets: 0,
        purchasedBuckets: 100,
      },
      '2026-08-31T23:59:00.000Z',
    );

    expect(snapshot).toEqual({
      calculatedAt: '2026-08-31T23:59:00.000Z',
      closingBalance: 30,
      delivered: 70,
      openingBalance: 0,
      period: '2026-08',
      purchased: 100,
    });
  });

  it('maps the future Firebase node without adding redundant fields', () => {
    const snapshots: StockSnapshotMap = {
      '2026-08': {
        calculatedAt: '2026-08-31T23:59:00.000Z',
        closingBalance: 30,
        delivered: 70,
        openingBalance: 0,
        period: '2026-08',
        purchased: 100,
      },
    };

    const payload = toFirebaseStockSnapshots(snapshots);

    expect(payload).toEqual(snapshots);
    expect(mapStockSnapshots(payload)).toEqual(snapshots);
    expect(Object.keys(payload['2026-08'] as object).sort()).toEqual([
      'calculatedAt',
      'closingBalance',
      'delivered',
      'openingBalance',
      'period',
      'purchased',
    ]);
  });

  it('allows mock snapshot replacement without making it an active source of truth', async () => {
    const snapshot = stockCalculationService.createSnapshot('2026-08', {
      deliveredBuckets: 70,
      endingBuckets: 30,
      openingBuckets: 0,
      purchasedBuckets: 100,
    });

    await mockStockSnapshotRepository.save(snapshot);
    await expect(mockStockSnapshotRepository.readAll()).resolves.toEqual({
      '2026-08': snapshot,
    });
  });

  it('does not write snapshots while Firebase app data is disabled', async () => {
    expect(ENABLE_FIREBASE_WRITES).toBe(false);
    const repository = new FirebaseStockSnapshotRepository('test-user');
    const snapshot = stockCalculationService.createSnapshot('2026-08', {
      deliveredBuckets: 0,
      endingBuckets: 0,
      openingBuckets: 0,
      purchasedBuckets: 0,
    });

    await expect(repository.save(snapshot)).rejects.toThrow(
      'Snapshots de estoque permanecem desativados enquanto o Firebase estiver desligado.',
    );
  });
});
