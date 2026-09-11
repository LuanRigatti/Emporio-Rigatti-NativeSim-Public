export type NativeToolbarDateItem = {
  label: string;
  value: number;
};

const NATIVE_MONTH_ABBREVIATIONS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

export function createNativeMonthItems(): readonly NativeToolbarDateItem[] {
  return Array.from({ length: 12 }, (_, index) => ({
    label: monthLabel(index + 1),
    value: index + 1,
  }));
}

export function createNativeYearItems(): readonly NativeToolbarDateItem[] {
  return [2024, 2025, 2026].map((year) => ({ label: String(year), value: year }));
}

export function createNativeDayItems(year: number, month: number): readonly number[] {
  return Array.from({ length: daysInMonth(year, month) }, (_, index) => index + 1);
}

export function formatNativeToolbarDate(value: Date): string {
  return `${value.getDate()} ${NATIVE_MONTH_ABBREVIATIONS[value.getMonth()]}`;
}

export function updateNativeDate(
  value: Date,
  updates: Partial<{ day: number; month: number; year: number }>,
): Date {
  const nextYear = updates.year ?? value.getFullYear();
  const nextMonth = updates.month ?? value.getMonth() + 1;
  const nextDay = Math.min(updates.day ?? value.getDate(), daysInMonth(nextYear, nextMonth));
  const next = new Date(value);

  next.setFullYear(nextYear, nextMonth - 1, nextDay);
  return next;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function monthLabel(month: number): string {
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(
    new Date(2026, month - 1, 1),
  );
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}
