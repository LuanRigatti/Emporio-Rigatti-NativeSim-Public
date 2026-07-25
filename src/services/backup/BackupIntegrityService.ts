import type { UserDataSnapshot } from '@/services/data';
import type { BackupData, BackupRecordCounts, UnknownRecord } from '@/types/data';
import { isRecord } from '@/utils/data';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;

  return Object.keys(value)
    .sort()
    .filter((key) => {
      const field = value[key];
      return !(key === 'legacyFields' && isRecord(field) && Object.keys(field).length === 0);
    })
    .reduce<UnknownRecord>((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
}

export function fingerprint(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function countBackupData(data: BackupData): BackupRecordCounts {
  return {
    customClients: Object.keys(data.clientesCustom ?? {}).length,
    dailyExpenses: Object.keys(data.gastosDiarios).length,
    deliveries: data.entregas.length,
    factoryPayments: data.recebimentoBaldes.reduce(
      (total, receipt) => total + receipt.pagamentos.length,
      0,
    ),
    factoryReceipts: data.recebimentoBaldes.length,
    monthlyExpenses: Object.keys(data.gastosMensais).length,
  };
}

export function backupDataFromSnapshot(snapshot: UserDataSnapshot): BackupData {
  return {
    clientesCustom: snapshot.clientesCustom,
    entregas: snapshot.entregas,
    gastosDiarios: snapshot.gastosDiarios,
    gastosMensais: snapshot.gastosMensais,
    recebimentoBaldes: snapshot.recebimentoBaldes,
  };
}

export class BackupIntegrityService {
  public verify(expected: UserDataSnapshot, actual: UserDataSnapshot): boolean {
    return (
      fingerprint(backupDataFromSnapshot(expected)) === fingerprint(backupDataFromSnapshot(actual))
    );
  }
}

export const backupIntegrityService = new BackupIntegrityService();
