import type { CustomClient } from '@/types/data';
import { mapCustomClients, toFirebaseCustomClients } from '@/mappers/firebase';
import { validateCustomClients } from '@/utils/data';

import { RealtimeNodeRepository, type NodeCodec } from './RealtimeNodeRepository';

const codec: NodeCodec<Record<string, CustomClient>> = {
  emptyValue: {},
  validate: validateCustomClients,
  fromFirebase: mapCustomClients,
  toFirebase: toFirebaseCustomClients,
};

export class CustomClientRepository extends RealtimeNodeRepository<Record<string, CustomClient>> {
  public constructor(uid: string) {
    super(uid, 'clientesCustom', codec);
  }
}
