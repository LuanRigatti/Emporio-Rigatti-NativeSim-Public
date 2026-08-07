import type {
  ClientId,
  Delivery,
  FactoryPayment,
  FactoryReceipt,
  UnknownRecord,
} from '@/types/data';

import { isRecord, readString } from './guards';

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

function warnInvalidFactoryValue(path: string, reason: string): void {
  if (__DEV__) {
    console.warn('[Firebase legacy data] Ignored invalid factory value.', { path, reason });
  }
}

function normalizeFactoryPayment(
  value: unknown,
  path: string,
  fallbackId?: string,
): FactoryPayment | undefined {
  if (!isRecord(value)) {
    warnInvalidFactoryValue(path, 'payment is not an object');
    return undefined;
  }

  const id = readString(value.id) ?? readString(fallbackId);
  const data = readString(value.data);
  const valor = normalizeMoney(value.valor);
  if (!id || !data || valor === undefined) {
    warnInvalidFactoryValue(path, 'payment is missing id, data, or a valid valor');
    return undefined;
  }

  return {
    id,
    data,
    valor,
    legacyFields: collectLegacyFields(value, new Set(['id', 'data', 'valor'])),
  };
}

export function normalizeFactoryPayments(value: unknown, path: string): FactoryPayment[] {
  if (value === undefined || value === null) return [];

  if (Array.isArray(value)) {
    return value.flatMap((payment, index) => {
      const normalized = normalizeFactoryPayment(payment, `${path}[${index}]`);
      return normalized ? [normalized] : [];
    });
  }

  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, payment]) => {
      const normalized = normalizeFactoryPayment(payment, `${path}.${key}`, key);
      return normalized ? [normalized] : [];
    });
  }

  warnInvalidFactoryValue(path, 'payments container has an unsupported format');
  return [];
}

export function normalizeFactoryReceipt(value: unknown, path: string): FactoryReceipt | undefined {
  if (!isRecord(value)) {
    warnInvalidFactoryValue(path, 'receipt is not an object');
    return undefined;
  }

  const id = readString(value.id);
  const quantidade = normalizeMoney(value.quantidade);
  const data = readString(value.data);
  const valorTotal = normalizeMoney(value.valorTotal);
  if (!id || quantidade === undefined || !data || valorTotal === undefined) {
    warnInvalidFactoryValue(path, 'receipt is missing required fields');
    return undefined;
  }
  if (typeof value.concluido !== 'boolean') {
    warnInvalidFactoryValue(path, 'receipt has an invalid concluido field');
    return undefined;
  }

  return {
    id,
    quantidade,
    data,
    valorTotal,
    concluido: value.concluido,
    pagamentos: normalizeFactoryPayments(value.pagamentos, `${path}.pagamentos`),
    legacyFields: collectLegacyFields(
      value,
      new Set(['id', 'quantidade', 'data', 'valorTotal', 'concluido', 'pagamentos']),
    ),
  };
}

const deliveryKeys = new Set([
  'id',
  'cliente',
  'quantidade',
  'valor',
  'precoUnitarioHistorico',
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
