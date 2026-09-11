import type { FactoryReceipt } from '@/types/data';
import { mapFactoryReceipts, toFirebaseFactoryReceipts } from '@/mappers/firebase';
import { validateFactoryReceipts } from '@/utils/data';

import { RealtimeNodeRepository, type NodeCodec } from './RealtimeNodeRepository';

const codec: NodeCodec<FactoryReceipt[]> = {
  emptyValue: [],
  validate: validateFactoryReceipts,
  fromFirebase: mapFactoryReceipts,
  toFirebase: toFirebaseFactoryReceipts,
};

export class FactoryReceiptRepository extends RealtimeNodeRepository<FactoryReceipt[]> {
  public constructor(uid: string) {
    super(uid, 'recebimentoBaldes', codec);
  }
}
