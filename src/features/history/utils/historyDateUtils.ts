import type { HistoryCalendarDay, HistoryDelivery } from '../data/historyMocks';

export const HISTORY_MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

const HISTORY_WEEKDAY_NAMES = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'] as const;

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function createHistoryDate(year: number, month: number, day: number): string {
  return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

export function formatHistoryMonth(month: number): string {
  return HISTORY_MONTH_NAMES[month - 1] ?? HISTORY_MONTH_NAMES[0];
}

export function generateHistoryCalendarDays(
  year: number,
  month: number,
): readonly HistoryCalendarDay[] {
  const daysInMonth = getDaysInMonth(year, month);

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const localDate = new Date(year, month - 1, day);

    return {
      date: createHistoryDate(year, month, day),
      weekday: HISTORY_WEEKDAY_NAMES[localDate.getDay()],
      dayNumber: padDatePart(day),
    };
  });
}

export function getAvailableHistoryYears(
  startYear = 2024,
  currentYear = new Date().getFullYear(),
): readonly number[] {
  const lastYear = Math.max(startYear, currentYear);
  return Array.from({ length: lastYear - startYear + 1 }, (_, index) => startYear + index);
}

export function getCurrentHistoryPeriod(): { month: number; year: number } {
  const today = new Date();
  return { month: today.getMonth() + 1, year: today.getFullYear() };
}

export function getInitialHistoryDate(
  year: number,
  month: number,
  deliveries: readonly HistoryDelivery[],
): string {
  const currentPeriod = getCurrentHistoryPeriod();
  if (currentPeriod.year === year && currentPeriod.month === month) {
    return createHistoryDate(year, month, new Date().getDate());
  }

  const firstDelivery = deliveries
    .filter((delivery) => delivery.data.startsWith(`${year}-${padDatePart(month)}-`))
    .sort((left, right) => left.data.localeCompare(right.data))[0];

  return firstDelivery?.data ?? createHistoryDate(year, month, 1);
}
