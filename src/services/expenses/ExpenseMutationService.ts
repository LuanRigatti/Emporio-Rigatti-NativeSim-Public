import { asyncStorageCacheService } from '@/services/cache';
import { userDataService } from '@/services/data';
import { DailyExpenseRepository, MonthlyExpenseRepository } from '@/repositories';
import type {
  DailyExpense,
  DailyExpenseDraft,
  MonthlyExpenseRecord,
  MonthlyLightDraft,
} from '@/types/data';
import type { UserDataSnapshot } from '@/services/data';
import { normalizeLegacyDate, normalizeMoney } from '@/utils/data';

import { createRouteKilometersExpense } from './routeKilometers';

export { createRouteKilometersExpense } from './routeKilometers';

function requiredDate(value: string): string {
  const date = normalizeLegacyDate(value);
  if (!date) throw new Error('Informe uma data válida.');
  return date;
}

function nonNegative(value: number, label: string): number {
  const normalized = normalizeMoney(value);
  if (normalized === undefined || normalized < 0)
    throw new Error(`Informe um valor válido para ${label}.`);
  return normalized;
}

export class ExpenseMutationService {
  public constructor(
    private readonly uid: string,
    private readonly readSnapshot: () => Promise<UserDataSnapshot> = () =>
      userDataService.readFromFirebase(uid),
  ) {}

  private async cacheSnapshot(snapshot: UserDataSnapshot): Promise<void> {
    await asyncStorageCacheService.write(this.uid, snapshot);
  }

  public async saveDailyExpense(draft: DailyExpenseDraft): Promise<DailyExpense> {
    const date = requiredDate(draft.date);
    const snapshot = await this.readSnapshot();
    const nextExpense: DailyExpense = {
      ...snapshot.gastosDiarios[date],
      data: date,
      estar: nonNegative(draft.estar, 'o Estar'),
      km: nonNegative(draft.km, 'a quilometragem'),
      precoGasolina: nonNegative(draft.fuelPrice, 'o preço do combustível'),
      tipoCombustivel: draft.fuelType || undefined,
    };
    if (draft.legacyFuelCost !== undefined) {
      nextExpense.gasolina = nonNegative(draft.legacyFuelCost, 'o combustível legado');
    }

    const nextSnapshot: UserDataSnapshot = {
      ...snapshot,
      gastosDiarios: { ...snapshot.gastosDiarios, [date]: nextExpense },
    };
    await new DailyExpenseRepository(this.uid).replace(nextSnapshot.gastosDiarios);
    await this.cacheSnapshot(nextSnapshot);
    return nextExpense;
  }

  public async saveRouteKilometers(dateValue: string, kilometers: number): Promise<DailyExpense> {
    const date = requiredDate(dateValue);
    const normalizedKm = nonNegative(kilometers, 'a quilometragem da rota');
    const snapshot = await this.readSnapshot();
    const nextExpense = createRouteKilometersExpense(
      date,
      normalizedKm,
      snapshot.gastosDiarios[date],
    );
    const nextSnapshot: UserDataSnapshot = {
      ...snapshot,
      gastosDiarios: { ...snapshot.gastosDiarios, [date]: nextExpense },
    };
    await new DailyExpenseRepository(this.uid).replace(nextSnapshot.gastosDiarios);
    await this.cacheSnapshot(nextSnapshot);
    return nextExpense;
  }

  public async saveMonthlyLight(draft: MonthlyLightDraft): Promise<MonthlyExpenseRecord> {
    if (!/^\d{4}-\d{2}$/.test(draft.month)) throw new Error('Informe um mês válido.');
    const value = Math.max(0, nonNegative(draft.light, 'a luz'));
    const snapshot = await this.readSnapshot();
    const previous = snapshot.gastosMensais[draft.month];
    const nextRecord: MonthlyExpenseRecord = {
      ...(typeof previous === 'object' ? previous : {}),
      luz: value,
    };
    const nextSnapshot: UserDataSnapshot = {
      ...snapshot,
      gastosMensais: { ...snapshot.gastosMensais, [draft.month]: nextRecord },
    };
    await new MonthlyExpenseRepository(this.uid).replace(nextSnapshot.gastosMensais);
    await this.cacheSnapshot(nextSnapshot);
    return nextRecord;
  }
}

export const createExpenseMutationService = (uid: string): ExpenseMutationService =>
  new ExpenseMutationService(uid);
