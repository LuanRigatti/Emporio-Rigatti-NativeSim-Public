import type { CustomClient } from './client';
import type { DailyExpenses, MonthlyExpenses } from './expenses';
import type { FactoryReceipt } from './factory';
import type { Delivery } from './delivery';

export interface BackupData {
  entregas: Delivery[];
  gastosDiarios: DailyExpenses;
  gastosMensais: MonthlyExpenses;
  recebimentoBaldes: FactoryReceipt[];
  clientesCustom?: Record<string, CustomClient>;
}

export type BackupSourceFormat = 'canonical' | 'legacy-deliveries-array' | 'legacy-factory-alias';

export type BackupConflictNode =
  'entregas' | 'gastosDiarios' | 'gastosMensais' | 'recebimentoBaldes' | 'clientesCustom';

export interface BackupConflict {
  node: BackupConflictNode;
  identifier: string;
  message: string;
}

export interface BackupRecordCounts {
  deliveries: number;
  dailyExpenses: number;
  monthlyExpenses: number;
  factoryReceipts: number;
  factoryPayments: number;
  customClients: number;
}

export interface BackupPreview {
  deliveries: number;
  dailyExpenses: number;
  monthlyExpenses: number;
  factoryReceipts: number;
  customClients: number;
  factoryPayments: number;
  sourceFormat: BackupSourceFormat;
  warnings: string[];
  conflicts: BackupConflict[];
}

export type BackupImportData = BackupData;

export interface BackupImportCandidate {
  data: BackupData;
  preview: BackupPreview;
  fileName: string;
}

export interface BackupExportResult {
  fileName: string;
  exportedAt: string;
  counts: BackupRecordCounts;
  uri?: string;
}

export interface BackupImportReport {
  backupId: string;
  sourceFormat: BackupSourceFormat;
  counts: BackupRecordCounts;
  imported: BackupRecordCounts;
  ignored: BackupRecordCounts;
  conflicts: BackupConflict[];
  integrityVerified: boolean;
  rolledBack: boolean;
}
