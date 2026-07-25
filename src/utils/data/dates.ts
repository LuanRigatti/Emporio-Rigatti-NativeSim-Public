import { normalizeLegacyDate } from './normalizers';

export function isValidIsoDate(value: string): boolean {
  const normalized = normalizeLegacyDate(value);
  if (!normalized) return false;
  const [year, month, day] = normalized.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function monthKey(value: string): string | undefined {
  const normalized = normalizeLegacyDate(value);
  return normalized?.slice(0, 7);
}
