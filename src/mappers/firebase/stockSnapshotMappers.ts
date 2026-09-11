import type { StockSnapshot, StockSnapshotMap, UnknownRecord } from '@/types/data';
import { isRecord, readNumber } from '@/utils/data/guards';

function requireRecord(value: unknown, path: string): UnknownRecord {
  if (!isRecord(value)) throw new Error(`${path} deve ser um objeto.`);
  return value;
}

function readRequiredNumber(value: unknown, path: string): number {
  const result = readNumber(value);
  if (result === undefined) throw new Error(`${path} deve ser um número válido.`);
  return result;
}

function readRequiredString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${path} deve ser uma string não vazia.`);
  }
  return value;
}

function readRequiredPeriod(value: unknown, path: string): string {
  const period = readRequiredString(value, path);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw new Error(`${path} deve estar no formato yyyy-MM.`);
  }
  return period;
}

export function mapStockSnapshot(value: unknown, path = 'stockSnapshots'): StockSnapshot {
  const record = requireRecord(value, path);
  return {
    calculatedAt: readRequiredString(record.calculatedAt, `${path}.calculatedAt`),
    closingBalance: readRequiredNumber(record.closingBalance, `${path}.closingBalance`),
    delivered: readRequiredNumber(record.delivered, `${path}.delivered`),
    openingBalance: readRequiredNumber(record.openingBalance, `${path}.openingBalance`),
    period: readRequiredPeriod(record.period, `${path}.period`),
    purchased: readRequiredNumber(record.purchased, `${path}.purchased`),
  };
}

export function mapStockSnapshots(value: unknown): StockSnapshotMap {
  const record = requireRecord(value, 'stockSnapshots');
  return Object.fromEntries(
    Object.entries(record).map(([period, snapshot]) => {
      const mapped = mapStockSnapshot(snapshot, `stockSnapshots.${period}`);
      if (mapped.period !== period) {
        throw new Error(`stockSnapshots.${period}.period deve corresponder à chave do período.`);
      }
      return [period, mapped];
    }),
  );
}

export function toFirebaseStockSnapshot(snapshot: StockSnapshot): UnknownRecord {
  return {
    calculatedAt: snapshot.calculatedAt,
    closingBalance: snapshot.closingBalance,
    delivered: snapshot.delivered,
    openingBalance: snapshot.openingBalance,
    period: snapshot.period,
    purchased: snapshot.purchased,
  };
}

export function toFirebaseStockSnapshots(snapshots: StockSnapshotMap): UnknownRecord {
  return Object.fromEntries(
    Object.entries(snapshots).map(([period, snapshot]) => [
      period,
      toFirebaseStockSnapshot(snapshot),
    ]),
  );
}
