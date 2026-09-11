import type {
  CustomClient,
  DailyExpenses,
  Delivery,
  FactoryReceipt,
  MonthlyExpenses,
} from '@/types/data';

export interface UserDataSnapshot {
  entregas: Delivery[];
  gastosDiarios: DailyExpenses;
  gastosMensais: MonthlyExpenses;
  recebimentoBaldes: FactoryReceipt[];
  clientesCustom: Record<string, CustomClient>;
  pushToken?: string;
}

export interface CachedUserDataSnapshot extends UserDataSnapshot {
  ts: number;
}
