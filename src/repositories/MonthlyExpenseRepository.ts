import type { MonthlyExpenses } from '@/types/data';
import { mapMonthlyExpenses, toFirebaseMonthlyExpenses } from '@/mappers/firebase';
import { validateMonthlyExpenses } from '@/utils/data';

import { RealtimeNodeRepository, type NodeCodec } from './RealtimeNodeRepository';

const codec: NodeCodec<MonthlyExpenses> = {
  emptyValue: {},
  validate: validateMonthlyExpenses,
  fromFirebase: mapMonthlyExpenses,
  toFirebase: toFirebaseMonthlyExpenses,
};

export class MonthlyExpenseRepository extends RealtimeNodeRepository<MonthlyExpenses> {
  public constructor(uid: string) {
    super(uid, 'gastosMensais', codec);
  }
}
