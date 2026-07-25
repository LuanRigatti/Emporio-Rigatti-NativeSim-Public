import type { UnknownRecord } from '@/types/data';

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function readString(value: unknown): string | undefined {
  return isString(value) && value.trim().length > 0 ? value : undefined;
}

export function readNumber(value: unknown): number | undefined {
  if (isFiniteNumber(value)) return value;
  if (!isString(value) || value.trim().length === 0) return undefined;

  let normalized = value.trim().replace(/[R$\s]/g, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}
