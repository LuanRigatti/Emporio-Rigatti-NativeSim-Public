import {
  CustomClientRepository,
  DailyExpenseRepository,
  DeliveryRepository,
  FactoryReceiptRepository,
  MonthlyExpenseRepository,
} from '@/repositories';
import { userDataService, type UserDataSnapshot } from '@/services/data';
import type {
  BackupData,
  BackupExportResult,
  BackupImportCandidate,
  BackupImportReport,
} from '@/types/data';
import { DataError, toDataError } from '@/services/data';

import { backupFileService, type GeneratedBackupFile } from './BackupFileService';
import {
  backupDataFromSnapshot,
  backupIntegrityService,
  countBackupData,
} from './BackupIntegrityService';
import { backupMergeService } from './BackupMergeService';
import { backupPreventiveService } from './BackupPreventiveService';
import { backupValidationService } from './BackupValidationService';

export interface BackupServiceDependencies {
  readSnapshot?: () => Promise<UserDataSnapshot>;
  writeData?: (data: BackupData) => Promise<void>;
}

async function writeUserData(uid: string, data: BackupData): Promise<void> {
  await new DeliveryRepository(uid).replace(data.entregas);
  await new DailyExpenseRepository(uid).replace(data.gastosDiarios);
  await new MonthlyExpenseRepository(uid).replace(data.gastosMensais);
  await new FactoryReceiptRepository(uid).replace(data.recebimentoBaldes);
  await new CustomClientRepository(uid).replace(data.clientesCustom ?? {});
}

function expectedSnapshot(current: UserDataSnapshot, data: BackupData): UserDataSnapshot {
  return {
    ...current,
    clientesCustom: data.clientesCustom ?? {},
    entregas: data.entregas,
    gastosDiarios: data.gastosDiarios,
    gastosMensais: data.gastosMensais,
    recebimentoBaldes: data.recebimentoBaldes,
  };
}

export class BackupService {
  private readonly readSnapshot: () => Promise<UserDataSnapshot>;
  private readonly writeData: (data: BackupData) => Promise<void>;

  public constructor(
    private readonly uid: string,
    dependencies: BackupServiceDependencies = {},
  ) {
    this.readSnapshot = dependencies.readSnapshot ?? (() => userDataService.readFromFirebase(uid));
    this.writeData = dependencies.writeData ?? ((data) => writeUserData(uid, data));
  }

  public async exportBackup(): Promise<BackupExportResult> {
    let generated: GeneratedBackupFile | undefined;
    try {
      const snapshot = await this.readSnapshot();
      const data = backupDataFromSnapshot(snapshot);
      generated = await backupFileService.createExportFile(data);
      await backupFileService.shareOrDownload(generated);
      return {
        counts: countBackupData(data),
        exportedAt: generated.exportedAt,
        fileName: generated.fileName,
      };
    } catch (error) {
      throw toDataError(error, 'Não foi possível exportar o backup.');
    } finally {
      if (generated) backupFileService.release(generated);
    }
  }

  public async selectImportFile(): Promise<BackupImportCandidate | null> {
    try {
      const selected = await backupFileService.pickJsonFile();
      if (!selected) return null;
      const validation = backupValidationService.parse(selected.contents);
      const candidate: BackupImportCandidate = {
        data: validation.data,
        fileName: selected.fileName,
        preview: validation.preview,
      };
      const current = backupDataFromSnapshot(await this.readSnapshot());
      const merge = backupMergeService.merge(current, candidate);
      return {
        ...candidate,
        preview: { ...candidate.preview, conflicts: merge.conflicts },
      };
    } catch (error) {
      throw toDataError(error, 'Não foi possível validar o arquivo de backup.');
    }
  }

  public async importBackup(candidate: BackupImportCandidate): Promise<BackupImportReport> {
    const currentSnapshot = await this.readSnapshot();
    const currentData = backupDataFromSnapshot(currentSnapshot);
    const merged = backupMergeService.merge(currentData, candidate);
    const preventive = await backupPreventiveService.create(currentData);

    try {
      await this.writeData(merged.data);
      const actualSnapshot = await this.readSnapshot();
      const expected = expectedSnapshot(currentSnapshot, merged.data);
      if (!backupIntegrityService.verify(expected, actualSnapshot)) {
        throw new DataError('conflict', 'A verificação de integridade do backup falhou.');
      }

      return {
        backupId: preventive.backupId,
        conflicts: merged.conflicts,
        counts: countBackupData(candidate.data),
        ignored: merged.ignored,
        imported: merged.imported,
        integrityVerified: true,
        rolledBack: false,
        sourceFormat: candidate.preview.sourceFormat,
      };
    } catch (error) {
      try {
        await this.writeData(currentData);
      } catch (rollbackError) {
        throw new DataError(
          'conflict',
          `A importação falhou e a restauração preventiva também falhou: ${String(rollbackError)}`,
          rollbackError,
        );
      }
      if (error instanceof DataError) {
        throw new DataError(
          'conflict',
          `${error.message} Os dados anteriores foram restaurados. Backup preventivo: ${preventive.backupId}.`,
          error,
        );
      }
      throw new DataError(
        'unknown',
        `A importação falhou. Os dados anteriores foram restaurados. Backup: ${preventive.backupId}.`,
        error,
      );
    }
  }
}

export function createBackupService(
  uid: string,
  dependencies?: BackupServiceDependencies,
): BackupService {
  return new BackupService(uid, dependencies);
}
