import type { ClientId, Delivery, UnknownRecord } from '@/types/data';

export function normalizeMoney(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || value.trim() === '') return undefined;

  let normalized = value.trim().replace(/[R$\s]/g, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeLegacyDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) return trimmed;

  const legacy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  return legacy ? `${legacy[3]}-${legacy[2]}-${legacy[1]}` : undefined;
}

export function normalizeClientKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizeClientAlias(value: string): string {
  const key = normalizeClientKey(value);
  if (key === 'santos') return 'Elias';
  if (key === 'vianna') return 'Viana';
  if (['adri guilhem', 'adriguilhem', 'adri guilherme', 'adri guilhen'].includes(key)) {
    return 'Adri';
  }
  return value;
}

export function formatClientName(value: string): string {
  return normalizeClientAlias(value)
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function clientIdFromName(value: string): ClientId {
  return `legacy:${normalizeClientKey(formatClientName(value))}`;
}

export function isAliasName(value: string): boolean {
  return normalizeClientAlias(value) !== value.trim();
}

const deliveryKeys = new Set([
  'id',
  'cliente',
  'quantidade',
  'valor',
  'status',
  'entregue',
  'data',
  'invoiceStatus',
  'endereco',
  'metodoPagamento',
  'observacao',
]);

export function collectLegacyFields(record: UnknownRecord, knownKeys: Set<string>): UnknownRecord {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !knownKeys.has(key)));
}

export function collectDeliveryLegacyFields(record: UnknownRecord): UnknownRecord {
  return collectLegacyFields(record, deliveryKeys);
}

export function toPersistedDelivery(delivery: Delivery): UnknownRecord {
  const { legacyFields = {}, ...knownFields } = delivery;
  return { ...legacyFields, ...knownFields };
}
