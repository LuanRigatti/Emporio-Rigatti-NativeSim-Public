import type { StockSnapshot, StockSnapshotMap } from '@/types/data';

import type { StockSnapshotRepository } from './StockSnapshotRepository';

function clone(snapshot: StockSnapshot): StockSnapshot {
  return { ...snapshot };
}

export class MockStockSnapshotRepository implements StockSnapshotRepository {
  private snapshots: StockSnapshotMap = {};

  public async readAll(): Promise<StockSnapshotMap> {
    return Object.fromEntries(
      Object.entries(this.snapshots).map(([period, snapshot]) => [period, clone(snapshot)]),
    );
  }

  public async replaceAll(snapshots: StockSnapshotMap): Promise<void> {
    this.snapshots = Object.fromEntries(
      Object.entries(snapshots).map(([period, snapshot]) => [period, clone(snapshot)]),
    );
  }

  public async save(snapshot: StockSnapshot): Promise<void> {
    this.snapshots[snapshot.period] = clone(snapshot);
  }
}

export const mockStockSnapshotRepository = new MockStockSnapshotRepository();
