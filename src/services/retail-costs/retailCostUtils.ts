import { normalizeClientKey, normalizeMoney } from '@/utils/data';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isStrictRetailIsoDate(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE_PATTERN.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function normalizeRetailDate(value: string): string {
  const normalized = value.trim();
  if (!isStrictRetailIsoDate(normalized)) {
    throw new Error('Informe uma data válida no formato AAAA-MM-DD.');
  }
  return normalized;
}

export function normalizeRetailMoney(value: unknown, label: string): number {
  const parsed = normalizeMoney(value);
  if (parsed === undefined || !Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} deve ser zero ou maior.`);
  }
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

export function normalizeRetailQuantity(value: unknown, label: string): number {
  const parsed = normalizeMoney(value);
  if (parsed === undefined || !Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} deve ser maior que zero.`);
  }
  return parsed;
}

export function normalizeRetailUnit(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error('Informe a unidade-base do item de custo.');
  return normalized;
}

export function retailUnitsMatch(left: string, right: string): boolean {
  return normalizeClientKey(left) === normalizeClientKey(right);
}

export function optionalRetailText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function normalizeRetailName(value: string): {
  name: string;
  normalizedName: string;
} {
  const name = value.trim();
  const normalizedName = normalizeClientKey(name);
  if (!name || !normalizedName) throw new Error('Informe o nome do item de custo.');
  return { name, normalizedName };
}
