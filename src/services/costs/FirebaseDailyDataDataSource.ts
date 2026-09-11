import {
  mapDailyExpenses,
  mapMonthlyExpenses,
  toFirebaseDailyExpenses,
  toFirebaseMonthlyExpenses,
} from '@/mappers/firebase';
import type { DailyExpenses, MonthlyExpenses } from '@/types/data';

import { EMPTY_COST_VALUES, type CostSettings } from './CostSettingsStorage';
import type { FirebaseDailyDataPayload } from './DailyDataDataSource';

/**
 * Adapter preparado para o formato legado do Firebase.
 * Ele não executa leitura/escrita remota e não é o datasource ativo nesta etapa.
 */
export class FirebaseDailyDataDataSource {
  public fromLegacy(payload: FirebaseDailyDataPayload): CostSettings {
    const settings = {
      periods: {
        day: Object.fromEntries(
          Object.entries(payload.gastosDiarios).map(([date, expense]) => [
            date,
            {
              ...EMPTY_COST_VALUES,
              estar: toInput(expense.estar),
              fuel: toInput(expense.gasolina),
              fuelPrice: toInput(expense.precoGasolina),
              fuelType: expense.tipoCombustivel ?? '',
              kilometers: toInput(expense.km),
            },
          ]),
        ),
        month: Object.fromEntries(
          Object.entries(payload.gastosMensais).map(([month, expense]) => [
            month,
            {
              ...EMPTY_COST_VALUES,
              light: toInput(typeof expense === 'number' ? expense : expense.luz),
            },
          ]),
        ),
        year: {},
      },
    } satisfies CostSettings;

    return settings;
  }

  public toLegacy(settings: CostSettings): FirebaseDailyDataPayload {
    const dailyExpenses: DailyExpenses = Object.fromEntries(
      Object.entries(settings.periods.day).map(([date, values]) => [
        date,
        {
          data: date,
          estar: toNumber(values.estar),
          gasolina: toNumber(values.fuel),
          km: toNumber(values.kilometers),
          precoGasolina: toNumber(values.fuelPrice),
          tipoCombustivel: values.fuelType || undefined,
        },
      ]),
    );
    const monthlyExpenses: MonthlyExpenses = Object.fromEntries(
      Object.entries(settings.periods.month).map(([month, values]) => [
        month,
        {
          luz: toNumber(values.light),
        },
      ]),
    );

    return {
      gastosDiarios: mapDailyExpenses(toFirebaseDailyExpenses(dailyExpenses)),
      gastosMensais: mapMonthlyExpenses(toFirebaseMonthlyExpenses(monthlyExpenses)),
    };
  }
}

export const firebaseDailyDataDataSource = new FirebaseDailyDataDataSource();

function toInput(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

function toNumber(value: string): number | undefined {
  const normalized = value.trim().replace(/R\$\s?/g, '');
  if (!normalized) return undefined;
  const parsed = Number(
    normalized.includes(',') ? normalized.replace(/\./g, '').replace(',', '.') : normalized,
  );
  return Number.isFinite(parsed) ? parsed : undefined;
}
