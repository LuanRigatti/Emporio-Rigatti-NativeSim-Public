import type { DailyExpenses, MonthlyExpenses } from '@/types/data';

import type { CostSettings, CostSettingsOperationOptions } from './CostSettingsStorage';

/**
 * Contrato de persistência dos dados diários editáveis.
 *
 * A implementação ativa é local. O contrato não expõe AsyncStorage para a UI
 * e pode receber uma implementação Firebase em uma etapa posterior.
 */
export interface DailyDataDataSource {
  load(scope?: string, options?: CostSettingsOperationOptions): Promise<CostSettings>;
  save(
    settings: CostSettings,
    scope?: string,
    options?: CostSettingsOperationOptions,
  ): Promise<void>;
}

export interface FirebaseDailyDataPayload {
  gastosDiarios: DailyExpenses;
  gastosMensais: MonthlyExpenses;
}

export type DailyDataField =
  'estar' | 'other' | 'fuel' | 'fuelPrice' | 'fuelType' | 'kilometers' | 'light';

export interface DailyDataRecord {
  date: string;
  estar: number;
  other: number;
  fuel: number;
  fuelPrice: number;
  fuelType?: string;
  manualKilometers: number;
  automaticKilometers: number;
  totalKilometers: number;
}
