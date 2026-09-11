import { normalizeLegacyDate } from './normalizers';

const shortMonthNames = [
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

const monthNames = [
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

export function todayIso(today = new Date()): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`;
}

export function parseIsoCalendarDate(value: string): Date | undefined {
  const normalized = normalizeLegacyDate(value);
  if (!normalized) return undefined;
  const [year, month, day] = normalized.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : undefined;
}

export function isValidIsoDate(value: string): boolean {
  return Boolean(parseIsoCalendarDate(value));
}

export function monthKey(value: string): string | undefined {
  const normalized = normalizeLegacyDate(value);
  return normalized?.slice(0, 7);
}

export function formatPtBrDate(value: string): string {
  const date = parseIsoCalendarDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatPtBrLongDate(value: string): string {
  const date = parseIsoCalendarDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatPtBrDayMonth(value: string): string {
  const date = parseIsoCalendarDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(date);
}

export function formatOperationalDate(value: string, referenceDate = todayIso()): string {
  const dayMonth = formatPtBrDayMonth(value);
  return value === referenceDate ? `Hoje, ${dayMonth}` : dayMonth;
}

export function formatPtBrMonthYear(value: string): string {
  const date = parseIsoCalendarDate(`${value}-01`);
  if (!date) return value;
  return `${monthNames[date.getMonth()] ?? value} ${date.getFullYear()}`;
}

export function formatPtBrCompactMonthYear(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  const month = Number(match[2]);
  return `${shortMonthNames[month - 1] ?? value}/${match[1].slice(-2)}`;
}
