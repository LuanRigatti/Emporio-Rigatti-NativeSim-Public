import type {
  BackupConflict,
  BackupConflictNode,
  BackupData,
  BackupImportCandidate,
  BackupRecordCounts,
  Delivery,
  FactoryReceipt,
} from '@/types/data';
import { normalizeClientKey } from '@/utils/data';

import { fingerprint } from './BackupIntegrityService';

export interface BackupMergeResult {
  data: BackupData;
  imported: BackupRecordCounts;
  ignored: BackupRecordCounts;
  conflicts: BackupConflict[];
}

function zeroCounts(): BackupRecordCounts {
  return {
    customClients: 0,
    dailyExpenses: 0,
    deliveries: 0,
    factoryPayments: 0,
    factoryReceipts: 0,
    monthlyExpenses: 0,
  };
}

function mergeArray<T extends { id: string }>(
  node: Extract<BackupConflictNode, 'entregas' | 'recebimentoBaldes'>,
  current: T[],
  incoming: T[],
  imported: BackupRecordCounts,
  ignored: BackupRecordCounts,
  conflicts: BackupConflict[],
  itemCount: keyof BackupRecordCounts,
): T[] {
  const result = [...current];
  const currentById = new Map(current.map((item) => [item.id, item]));

  for (const item of incoming) {
    const existing = currentById.get(item.id);
    if (!existing) {
      result.push(item);
      imported[itemCount] += 1;
      continue;
    }
    if (fingerprint(existing) === fingerprint(item)) {
      ignored[itemCount] += 1;
    } else {
      conflicts.push({
        identifier: item.id,
        message: 'O registro já existe com dados diferentes e foi preservado.',
        node,
      });
      ignored[itemCount] += 1;
    }
  }

  return result;
}

function mergeMap<T>(
  node: Extract<BackupConflictNode, 'gastosDiarios' | 'gastosMensais'>,
  current: Record<string, T>,
  incoming: Record<string, T>,
  imported: BackupRecordCounts,
  ignored: BackupRecordCounts,
  conflicts: BackupConflict[],
  itemCount: keyof BackupRecordCounts,
): Record<string, T> {
  const result = { ...current };
  for (const [key, value] of Object.entries(incoming)) {
    const existing = result[key];
    if (existing === undefined) {
      result[key] = value;
      imported[itemCount] += 1;
    } else if (fingerprint(existing) === fingerprint(value)) {
      ignored[itemCount] += 1;
    } else {
      conflicts.push({
        identifier: key,
        message: 'A chave já existe com dados diferentes e foi preservada.',
        node,
      });
      ignored[itemCount] += 1;
    }
  }
  return result;
}

function mergeClients(
  current: NonNullable<BackupData['clientesCustom']>,
  incoming: NonNullable<BackupData['clientesCustom']>,
  imported: BackupRecordCounts,
  ignored: BackupRecordCounts,
  conflicts: BackupConflict[],
): NonNullable<BackupData['clientesCustom']> {
  const result = { ...current };
  const currentByNormalizedName = new Map(
    Object.entries(current).map(([name, client]) => [normalizeClientKey(name), { client, name }]),
  );

  for (const [name, client] of Object.entries(incoming)) {
    const normalizedName = normalizeClientKey(name);
    const existingEntry = currentByNormalizedName.get(normalizedName);
    if (!existingEntry) {
      result[name] = client;
      imported.customClients += 1;
    } else if (fingerprint(existingEntry.client) === fingerprint(client)) {
      ignored.customClients += 1;
    } else {
      conflicts.push({
        identifier: name,
        message: `O cliente colide com ${existingEntry.name} e a configuração atual foi preservada.`,
        node: 'clientesCustom',
      });
      ignored.customClients += 1;
    }
  }
  return result;
}

export class BackupMergeService {
  public merge(current: BackupData, candidate: BackupImportCandidate): BackupMergeResult {
    const imported = zeroCounts();
    const ignored = zeroCounts();
    const conflicts: BackupConflict[] = [];
    const incoming = candidate.data;

    const deliveries = mergeArray<Delivery>(
      'entregas',
      current.entregas,
      incoming.entregas,
      imported,
      ignored,
      conflicts,
      'deliveries',
    );
    const factoryReceipts = mergeArray<FactoryReceipt>(
      'recebimentoBaldes',
      current.recebimentoBaldes,
      incoming.recebimentoBaldes,
      imported,
      ignored,
      conflicts,
      'factoryReceipts',
    );
    const currentReceiptsById = new Map(
      current.recebimentoBaldes.map((receipt) => [receipt.id, receipt]),
    );
    for (const receipt of incoming.recebimentoBaldes) {
      const existing = currentReceiptsById.get(receipt.id);
      if (!existing) {
        imported.factoryPayments += receipt.pagamentos.length;
      } else {
        ignored.factoryPayments += receipt.pagamentos.length;
      }
    }

    const data: BackupData = {
      clientesCustom: mergeClients(
        current.clientesCustom ?? {},
        incoming.clientesCustom ?? {},
        imported,
        ignored,
        conflicts,
      ),
      entregas: deliveries,
      gastosDiarios: mergeMap(
        'gastosDiarios',
        current.gastosDiarios,
        incoming.gastosDiarios,
        imported,
        ignored,
        conflicts,
        'dailyExpenses',
      ),
      gastosMensais: mergeMap(
        'gastosMensais',
        current.gastosMensais,
        incoming.gastosMensais,
        imported,
        ignored,
        conflicts,
        'monthlyExpenses',
      ),
      recebimentoBaldes: factoryReceipts,
    };

    return { conflicts, data, ignored, imported };
  }
}

export const backupMergeService = new BackupMergeService();
