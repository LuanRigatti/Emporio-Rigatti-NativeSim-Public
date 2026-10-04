import type { RouteFinancialSummary } from '@/types/routeTracking';

export const ROUTE_FINANCIAL_LEDGER_COLLECTION = 'routeFinancialLedger';
export const ROUTE_FINANCIAL_LEDGER_SCHEMA_VERSION = 1 as const;

export type RouteFinancialLedgerRecord = {
  routeId: string;
  date?: string;
  distanceMeters?: number;
  schemaVersion: typeof ROUTE_FINANCIAL_LEDGER_SCHEMA_VERSION;
  status: 'active' | 'deleted';
  createdAt?: unknown;
  updatedAt?: unknown;
  deletedAt?: unknown;
};

const ALLOWED_RECORD_KEYS = new Set([
  'routeId',
  'date',
  'distanceMeters',
  'schemaVersion',
  'status',
  'createdAt',
  'updatedAt',
  'deletedAt',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isValidRouteFinancialDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function isValidRouteFinancialId(routeId: string): boolean {
  return routeId.trim().length > 0 && !routeId.includes('/');
}

export function parseRouteFinancialLedgerRecord(
  value: unknown,
  documentId?: string,
): RouteFinancialLedgerRecord | null {
  if (!isRecord(value)) return null;
  if (Object.keys(value).some((key) => !ALLOWED_RECORD_KEYS.has(key))) return null;

  const routeId = typeof value.routeId === 'string' ? value.routeId : '';
  const status = value.status;
  if (
    !isValidRouteFinancialId(routeId) ||
    (documentId !== undefined && routeId !== documentId) ||
    value.schemaVersion !== ROUTE_FINANCIAL_LEDGER_SCHEMA_VERSION ||
    (status !== 'active' && status !== 'deleted')
  ) {
    return null;
  }

  if (status === 'deleted') {
    const date = isValidRouteFinancialDate(value.date) ? value.date : undefined;
    const distanceMeters =
      typeof value.distanceMeters === 'number' &&
      Number.isFinite(value.distanceMeters) &&
      value.distanceMeters >= 0
        ? value.distanceMeters
        : undefined;
    return {
      ...(date !== undefined ? { date } : {}),
      ...(distanceMeters !== undefined ? { distanceMeters } : {}),
      routeId,
      schemaVersion: ROUTE_FINANCIAL_LEDGER_SCHEMA_VERSION,
      status,
      ...(value.createdAt !== undefined ? { createdAt: value.createdAt } : {}),
      ...(value.updatedAt !== undefined ? { updatedAt: value.updatedAt } : {}),
      ...(value.deletedAt !== undefined ? { deletedAt: value.deletedAt } : {}),
    };
  }

  if (
    !isValidRouteFinancialDate(value.date) ||
    typeof value.distanceMeters !== 'number' ||
    !Number.isFinite(value.distanceMeters) ||
    value.distanceMeters < 0
  ) {
    return null;
  }

  return {
    date: value.date,
    distanceMeters: value.distanceMeters,
    routeId,
    schemaVersion: ROUTE_FINANCIAL_LEDGER_SCHEMA_VERSION,
    status,
    ...(value.createdAt !== undefined ? { createdAt: value.createdAt } : {}),
    ...(value.updatedAt !== undefined ? { updatedAt: value.updatedAt } : {}),
  };
}

export function toRouteFinancialSummary(
  record: RouteFinancialLedgerRecord,
): RouteFinancialSummary | null {
  if (
    record.status !== 'active' ||
    record.date === undefined ||
    record.distanceMeters === undefined
  ) {
    return null;
  }
  return { date: record.date, distanceMeters: record.distanceMeters, id: record.routeId };
}
