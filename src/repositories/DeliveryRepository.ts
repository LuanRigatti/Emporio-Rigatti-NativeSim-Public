import type { Delivery } from '@/types/data';
import { mapDeliveries, toFirebaseDeliveries } from '@/mappers/firebase';
import { validateDeliveryArray } from '@/utils/data';

import { RealtimeNodeRepository, type NodeCodec } from './RealtimeNodeRepository';

const codec: NodeCodec<Delivery[]> = {
  emptyValue: [],
  validate: validateDeliveryArray,
  fromFirebase: mapDeliveries,
  toFirebase: toFirebaseDeliveries,
};

export class DeliveryRepository extends RealtimeNodeRepository<Delivery[]> {
  public constructor(uid: string) {
    super(uid, 'entregas', codec);
  }
}
