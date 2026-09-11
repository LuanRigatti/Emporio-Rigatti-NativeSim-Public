import type { StockSnapshot, StockSnapshotMap } from '@/types/data';
import { ENABLE_FIREBASE_APP_DATA, ENABLE_FIREBASE_WRITES } from '@/config/featureFlags';
import { mapStockSnapshots, toFirebaseStockSnapshots } from '@/mappers/firebase';

import { RealtimeNodeRepository, type NodeCodec } from './RealtimeNodeRepository';
import type { StockSnapshotRepository } from './StockSnapshotRepository';

const codec: NodeCodec<StockSnapshotMap> = {
  emptyValue: {},
  fromFirebase: mapStockSnapshots,
  toFirebase: toFirebaseStockSnapshots,
  validate: (value) => {
    mapStockSnapshots(value);
  },
};

/**
 * Preparado para o futuro nó usuarios/{uid}/stockSnapshots/{yyyy-MM}.
 * Não é instanciado pelo fluxo mock atual.
 */
export class FirebaseStockSnapshotRepository
  extends RealtimeNodeRepository<StockSnapshotMap>
  implements StockSnapshotRepository
{
  public constructor(uid: string) {
    super(uid, 'stockSnapshots', codec);
  }

  public async readAll(): Promise<StockSnapshotMap> {
    return super.read();
  }

  public async replaceAll(snapshots: StockSnapshotMap): Promise<void> {
    this.assertWritesEnabled();
    await super.replace(snapshots);
  }

  public async save(snapshot: StockSnapshot): Promise<void> {
    this.assertWritesEnabled();
    const current = await this.readAll();
    await this.replaceAll({ ...current, [snapshot.period]: snapshot });
  }

  private assertWritesEnabled(): void {
    if (!ENABLE_FIREBASE_APP_DATA || !ENABLE_FIREBASE_WRITES) {
      throw new Error(
        'Snapshots de estoque permanecem desativados enquanto o Firebase estiver desligado.',
      );
    }
  }
}
