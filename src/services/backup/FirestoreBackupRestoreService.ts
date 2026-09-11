import { assertFirestoreUid } from '@/services/database/firestorePaths';

import {
  firestoreBackupValuesEqual,
  type FirestoreBackupComparisonEntity,
  type FirestoreBackupDryRunReport,
} from './FirestoreBackupComparisonService';
import {
  createFirestoreBackupDryRunService,
  type FirestoreBackupDryRunPreparation,
  type FirestoreBackupDryRunService,
  type FirestoreBackupDryRunServiceDependencies,
} from './FirestoreBackupDryRunService';
import {
  readFirestoreBackupSnapshot,
  type FirestoreBackupDocument,
  type FirestoreBackupPayload,
  type FirestoreBackupSnapshot,
} from './FirestoreBackupService';
import { deserializeFirestoreValue } from './FirestoreBackupValidationService';

const RESTORE_TRANSACTION_LIMIT = 400;

export type FirestoreBackupRestoreDocument = {
  entity: FirestoreBackupComparisonEntity;
  id: string;
  path: string;
  data: Record<string, unknown>;
};

export type FirestoreBackupRestoreFailedDocument = {
  entity: FirestoreBackupComparisonEntity;
  id: string;
  path: string;
  error: string;
};

export type FirestoreBackupRestoreCommitResult = {
  writesSucceeded: number;
  skippedDuringCommit: number;
  failedDocuments: readonly FirestoreBackupRestoreFailedDocument[];
};

export type FirestoreBackupRestoreServiceDependencies = {
  readSnapshot?: (uid: string) => Promise<FirestoreBackupSnapshot>;
  dryRunService?: FirestoreBackupDryRunService;
  dryRunDependencies?: FirestoreBackupDryRunServiceDependencies;
  commitOperations?: (
    uid: string,
    operations: readonly FirestoreBackupRestoreDocument[],
  ) => Promise<FirestoreBackupRestoreCommitResult>;
};

export type FirestoreBackupRestorePreparation = FirestoreBackupDryRunPreparation;

export type FirestoreBackupRestoreReport = {
  status: 'blocked' | 'completed' | 'partial-failure';
  fileName: string;
  created: number;
  skipped: number;
  conflicts: number;
  failed: number;
  writesAttempted: number;
  writesSucceeded: number;
  deletionsAttempted: 0;
  failedDocuments: readonly FirestoreBackupRestoreFailedDocument[];
  errors: readonly string[];
  postRestoreDryRun: FirestoreBackupDryRunReport | null;
  postRestoreEquivalent: boolean;
};

type RestorePlan = {
  operations: readonly FirestoreBackupRestoreDocument[];
  skipped: number;
  conflicts: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertDocumentId(id: string, label: string): void {
  if (!id || id.includes('/')) {
    throw new Error(`ID de documento inválido em ${label}.`);
  }
}

function restoreData(data: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const restored = deserializeFirestoreValue(data);
  if (!isRecord(restored)) throw new Error('Dados de documento inválidos para restauração.');
  return restored;
}

function documentsToMap(
  documents: readonly FirestoreBackupDocument[],
): Readonly<Record<string, Readonly<Record<string, unknown>>>> {
  return Object.fromEntries(documents.map((document) => [document.id, document.data]));
}

function settingsToMap(
  snapshot: FirestoreBackupSnapshot,
  key: 'factory' | 'car' | 'company',
): Readonly<Record<string, Readonly<Record<string, unknown>>>> {
  return snapshot.settings[key] ? { current: snapshot.settings[key] } : {};
}

function paymentsToMap(
  snapshot: FirestoreBackupSnapshot,
): Readonly<Record<string, Readonly<Record<string, unknown>>>> {
  return Object.fromEntries(
    snapshot.factoryReceipts.flatMap((receipt) =>
      receipt.payments.map((payment) => [`${receipt.id}/${payment.id}`, payment.data] as const),
    ),
  );
}

function addDocumentOperation(
  operations: FirestoreBackupRestoreDocument[],
  entity: FirestoreBackupComparisonEntity,
  id: string,
  pathSegments: readonly string[],
  data: Readonly<Record<string, unknown>>,
  current: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
  counters: { skipped: number; conflicts: number },
): void {
  if (entity !== 'payments') assertDocumentId(id, entity);
  pathSegments.forEach((segment) => assertDocumentId(segment, entity));
  const currentData = current[id];
  if (currentData) {
    if (firestoreBackupValuesEqual(data, currentData)) counters.skipped += 1;
    else counters.conflicts += 1;
    return;
  }

  operations.push({
    data: restoreData(data),
    entity,
    id,
    path: pathSegments.join('/'),
  });
}

function buildRestorePlan(
  uid: string,
  payload: FirestoreBackupPayload,
  current: FirestoreBackupSnapshot,
): RestorePlan {
  const operations: FirestoreBackupRestoreDocument[] = [];
  const counters = { conflicts: 0, skipped: 0 };
  const currentClients = documentsToMap(current.clients);
  const currentDeliveries = documentsToMap(current.deliveries);
  const currentDailyData = documentsToMap(current.dailyData);
  const currentMonthlyData = documentsToMap(current.monthlyData);
  const currentPayments = paymentsToMap(current);
  const currentReceipts = Object.fromEntries(
    current.factoryReceipts.map((receipt) => [receipt.id, receipt.data]),
  );

  Object.entries(payload.appData.clients).forEach(([id, data]) =>
    addDocumentOperation(
      operations,
      'clients',
      id,
      ['users', uid, 'clients', id],
      data,
      currentClients,
      counters,
    ),
  );
  Object.entries(payload.appData.deliveries).forEach(([id, data]) =>
    addDocumentOperation(
      operations,
      'deliveries',
      id,
      ['users', uid, 'deliveries', id],
      data,
      currentDeliveries,
      counters,
    ),
  );
  Object.entries(payload.appData.dailyData).forEach(([id, data]) =>
    addDocumentOperation(
      operations,
      'dailyData',
      id,
      ['users', uid, 'dailyData', id],
      data,
      currentDailyData,
      counters,
    ),
  );
  Object.entries(payload.appData.monthlyData).forEach(([id, data]) =>
    addDocumentOperation(
      operations,
      'monthlyData',
      id,
      ['users', uid, 'monthlyData', id],
      data,
      currentMonthlyData,
      counters,
    ),
  );

  Object.entries(payload.appData.factoryReceipts).forEach(([receiptId, receipt]) => {
    const currentReceiptData = currentReceipts[receiptId];
    const receiptConflict =
      currentReceiptData !== undefined &&
      !firestoreBackupValuesEqual(receipt.data, currentReceiptData);
    addDocumentOperation(
      operations,
      'factoryReceipts',
      receiptId,
      ['users', uid, 'factoryReceipts', receiptId],
      receipt.data,
      currentReceipts,
      counters,
    );
    Object.entries(receipt.payments).forEach(([paymentId, payment]) => {
      if (receiptConflict) {
        assertDocumentId(receiptId, 'factoryReceipts');
        assertDocumentId(paymentId, 'payments');
        counters.conflicts += 1;
        return;
      }
      addDocumentOperation(
        operations,
        'payments',
        `${receiptId}/${paymentId}`,
        ['users', uid, 'factoryReceipts', receiptId, 'payments', paymentId],
        payment,
        currentPayments,
        counters,
      );
    });
  });

  (['factory', 'car', 'company'] as const).forEach((key) => {
    const data = payload.appData.settings[key];
    if (!data) return;
    addDocumentOperation(
      operations,
      `settings/${key}`,
      'current',
      ['users', uid, 'settings', key],
      data,
      settingsToMap(current, key),
      counters,
    );
  });

  return { conflicts: counters.conflicts, operations, skipped: counters.skipped };
}

async function commitRestoreOperations(
  uid: string,
  operations: readonly FirestoreBackupRestoreDocument[],
): Promise<FirestoreBackupRestoreCommitResult> {
  if (operations.length === 0) {
    return { failedDocuments: [], skippedDuringCommit: 0, writesSucceeded: 0 };
  }

  const { doc, runTransaction } = await import('firebase/firestore');
  const { getFirebaseFirestore } = await import('@/services/firebase/firestore');
  const firestore = getFirebaseFirestore();
  let writesSucceeded = 0;
  let skippedDuringCommit = 0;
  const failedDocuments: FirestoreBackupRestoreFailedDocument[] = [];

  for (let start = 0; start < operations.length; start += RESTORE_TRANSACTION_LIMIT) {
    const chunk = operations.slice(start, start + RESTORE_TRANSACTION_LIMIT);
    try {
      const result = await runTransaction(firestore, async (transaction) => {
        const references = chunk.map((operation) => doc(firestore, operation.path));
        const snapshots = await Promise.all(
          references.map((reference) => transaction.get(reference)),
        );
        const missing = chunk.filter((_, index) => !snapshots[index].exists());
        missing.forEach((operation) => {
          const reference = doc(firestore, operation.path);
          transaction.set(reference, operation.data);
        });
        return missing.length;
      });
      writesSucceeded += result;
      skippedDuringCommit += chunk.length - result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha desconhecida na transação.';
      chunk.forEach((operation) =>
        failedDocuments.push({
          entity: operation.entity,
          error: message,
          id: operation.id,
          path: operation.path,
        }),
      );
    }
  }

  return { failedDocuments, skippedDuringCommit, writesSucceeded };
}

function emptyBlockedReport(fileName: string, reason: string): FirestoreBackupRestoreReport {
  return {
    conflicts: 0,
    created: 0,
    deletionsAttempted: 0,
    errors: [reason],
    failed: 0,
    failedDocuments: [],
    fileName,
    postRestoreDryRun: null,
    postRestoreEquivalent: false,
    skipped: 0,
    status: 'blocked',
    writesAttempted: 0,
    writesSucceeded: 0,
  };
}

export class FirestoreBackupRestoreService {
  private readonly readSnapshot: (uid: string) => Promise<FirestoreBackupSnapshot>;
  private readonly dryRunService: FirestoreBackupDryRunService;
  private readonly commitOperations: (
    uid: string,
    operations: readonly FirestoreBackupRestoreDocument[],
  ) => Promise<FirestoreBackupRestoreCommitResult>;

  public constructor(
    private readonly uid: string,
    dependencies: FirestoreBackupRestoreServiceDependencies = {},
  ) {
    assertFirestoreUid(uid);
    this.readSnapshot = dependencies.readSnapshot ?? readFirestoreBackupSnapshot;
    this.dryRunService =
      dependencies.dryRunService ??
      createFirestoreBackupDryRunService(uid, {
        ...dependencies.dryRunDependencies,
        readSnapshot: this.readSnapshot,
      });
    this.commitOperations = dependencies.commitOperations ?? commitRestoreOperations;
  }

  public async selectAndPrepare(): Promise<FirestoreBackupRestorePreparation | null> {
    return this.dryRunService.selectAndPrepare();
  }

  public async prepare(
    contents: string,
    fileName: string,
  ): Promise<FirestoreBackupRestorePreparation> {
    return this.dryRunService.prepare(contents, fileName);
  }

  public async restore(
    preparation: FirestoreBackupRestorePreparation,
    confirmed: boolean,
  ): Promise<FirestoreBackupRestoreReport> {
    if (!confirmed)
      return emptyBlockedReport(preparation.fileName, 'Confirmação explícita obrigatória.');
    if (preparation.report.status !== 'ready' || !preparation.validation.payload) {
      return emptyBlockedReport(preparation.fileName, 'O dry-run não autorizou a restauração.');
    }

    const latestSnapshot = await this.readSnapshot(this.uid);
    const plan = buildRestorePlan(this.uid, preparation.validation.payload, latestSnapshot);
    let commitResult: FirestoreBackupRestoreCommitResult = {
      failedDocuments: [],
      skippedDuringCommit: 0,
      writesSucceeded: 0,
    };
    const errors: string[] = [];

    try {
      if (plan.operations.length > 0) {
        commitResult = await this.commitOperations(this.uid, plan.operations);
      }
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : 'Falha desconhecida ao gravar o backup.',
      );
      commitResult = {
        failedDocuments: plan.operations.map((operation) => ({
          entity: operation.entity,
          error: errors[errors.length - 1],
          id: operation.id,
          path: operation.path,
        })),
        skippedDuringCommit: 0,
        writesSucceeded: 0,
      };
    }

    let postRestoreDryRun: FirestoreBackupDryRunReport | null = null;
    try {
      const afterPreparation = await this.dryRunService.prepare(
        JSON.stringify(preparation.validation.payload, null, 2),
        preparation.fileName,
      );
      postRestoreDryRun = afterPreparation.report;
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : 'Falha ao validar o estado pós-restauração.',
      );
    }

    const failedDocuments = commitResult.failedDocuments;
    const failed = failedDocuments.length;
    const writesSucceeded = commitResult.writesSucceeded;
    const postRestoreEquivalent =
      postRestoreDryRun !== null &&
      Object.values(postRestoreDryRun.entities).every(
        (entity) =>
          entity.wouldCreate === 0 &&
          entity.different === 0 &&
          entity.conflicts === 0 &&
          entity.invalidRecords === 0 &&
          entity.schemaErrors === 0,
      );
    return {
      conflicts: plan.conflicts,
      created: writesSucceeded,
      deletionsAttempted: 0,
      errors,
      failed,
      failedDocuments,
      fileName: preparation.fileName,
      postRestoreDryRun: postRestoreDryRun ?? preparation.report,
      postRestoreEquivalent,
      skipped: plan.skipped + commitResult.skippedDuringCommit,
      status: failed > 0 || errors.length > 0 ? 'partial-failure' : 'completed',
      writesAttempted: plan.operations.length,
      writesSucceeded,
    };
  }
}

export function createFirestoreBackupRestoreService(
  uid: string,
  dependencies?: FirestoreBackupRestoreServiceDependencies,
): FirestoreBackupRestoreService {
  return new FirestoreBackupRestoreService(uid, dependencies);
}
