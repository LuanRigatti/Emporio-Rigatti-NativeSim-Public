import type { DailyExpenses } from '@/types/data';
import { mapDailyExpenses, toFirebaseDailyExpenses } from '@/mappers/firebase';
import { validateDailyExpenses } from '@/utils/data';

import { RealtimeNodeRepository, type NodeCodec } from './RealtimeNodeRepository';

const codec: NodeCodec<DailyExpenses> = {
  emptyValue: {},
  validate: validateDailyExpenses,
  fromFirebase: mapDailyExpenses,
  toFirebase: toFirebaseDailyExpenses,
};

export class DailyExpenseRepository extends RealtimeNodeRepository<DailyExpenses> {
  public constructor(uid: string) {
    super(uid, 'gastosDiarios', codec);
  }
}
