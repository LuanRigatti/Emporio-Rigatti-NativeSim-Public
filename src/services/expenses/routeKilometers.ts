import type { DailyExpense } from '@/types/data';

export function createRouteKilometersExpense(
  date: string,
  kilometers: number,
  previous?: DailyExpense,
): DailyExpense {
  return { ...previous, data: date, km: kilometers };
}
