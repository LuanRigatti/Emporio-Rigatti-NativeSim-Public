import { assertFirestoreUid } from '@/services/database/firestorePaths';

import { backupFileService, type PickedBackupFile } from './BackupFileService';
import {
  blockedFirestoreBackupReport,
  compareFirestoreBackup,
  type FirestoreBackupDryRunReport,
} from './FirestoreBackupComparisonService';
import {
  readFirestoreBackupSnapshot,
  type FirestoreBackupSnapshot,
} from './FirestoreBackupService';
import {
  firestoreBackupValidationService,
  type FirestoreBackupValidationService,
  type ValidatedFirestoreBackup,
} from './FirestoreBackupValidationService';

export type FirestoreBackupDryRunServiceDependencies = {
  pickFile?: () => Promise<PickedBackupFile | null>;
  readSnapshot?: (uid: string) => Promise<FirestoreBackupSnapshot>;
  validationService?: FirestoreBackupValidationService;
};

export type FirestoreBackupDryRunPreparation = {
  fileName: string;
  validation: ValidatedFirestoreBackup;
  report: FirestoreBackupDryRunReport;
  currentSnapshot: FirestoreBackupSnapshot | null;
};

export class FirestoreBackupDryRunService {
  private readonly pickFile: () => Promise<PickedBackupFile | null>;
  private readonly readSnapshot: (uid: string) => Promise<FirestoreBackupSnapshot>;
  private readonly validationService: FirestoreBackupValidationService;

  public constructor(
    private readonly uid: string,
    dependencies: FirestoreBackupDryRunServiceDependencies = {},
  ) {
    assertFirestoreUid(uid);
    this.pickFile = dependencies.pickFile ?? (() => backupFileService.pickJsonFile());
    this.readSnapshot = dependencies.readSnapshot ?? readFirestoreBackupSnapshot;
    this.validationService = dependencies.validationService ?? firestoreBackupValidationService;
  }

  public async selectAndRun(): Promise<FirestoreBackupDryRunReport | null> {
    const selected = await this.pickFile();
    if (!selected) return null;
    const preparation = await this.prepare(selected.contents, selected.fileName);
    return preparation.report;
  }

  public async run(contents: string, fileName: string): Promise<FirestoreBackupDryRunReport> {
    const preparation = await this.prepare(contents, fileName);
    return preparation.report;
  }

  public async selectAndPrepare(): Promise<FirestoreBackupDryRunPreparation | null> {
    const selected = await this.pickFile();
    if (!selected) return null;
    return this.prepare(selected.contents, selected.fileName);
  }

  public async prepare(
    contents: string,
    fileName: string,
  ): Promise<FirestoreBackupDryRunPreparation> {
    const validation = await this.validationService.validate(contents, this.uid);
    if (!validation.canCompare || !validation.payload) {
      return {
        currentSnapshot: null,
        fileName,
        report: blockedFirestoreBackupReport(fileName, this.uid, validation),
        validation,
      };
    }

    const currentSnapshot = await this.readSnapshot(this.uid);
    const report = compareFirestoreBackup(
      validation.payload,
      currentSnapshot,
      fileName,
      validation.issues,
    );
    return { currentSnapshot, fileName, report, validation };
  }
}

export function createFirestoreBackupDryRunService(
  uid: string,
  dependencies?: FirestoreBackupDryRunServiceDependencies,
): FirestoreBackupDryRunService {
  return new FirestoreBackupDryRunService(uid, dependencies);
}
