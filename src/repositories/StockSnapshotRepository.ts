import type { StockSnapshot, StockSnapshotMap } from '@/types/data';

export interface StockSnapshotRepository {
  readAll(): Promise<StockSnapshotMap>;
  replaceAll(snapshots: StockSnapshotMap): Promise<void>;
  save(snapshot: StockSnapshot): Promise<void>;
}
