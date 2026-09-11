import type {
  FirestoreBackupDocument,
  FirestoreBackupPayload,
  FirestoreBackupSnapshot,
} from './FirestoreBackupService';
import type { FirestoreBackupValidationIssue } from './FirestoreBackupValidationService';

export type FirestoreBackupComparisonEntity =
  | 'clients'
  | 'deliveries'
  | 'factoryReceipts'
  | 'payments'
  | 'dailyData'
  | 'monthlyData'
  | 'settings/factory'
  | 'settings/car'
  | 'settings/company';

export type FirestoreBackupEntityReport = {
  totalInBackup: number;
  wouldCreate: number;
  identical: number;
  different: number;
  conflicts: number;
  schemaErrors: number;
  invalidRecords: number;
};

export type FirestoreBackupDryRunReport = {
  mode: 'read-only-dry-run';
  status: 'ready' | 'blocked';
  fileName: string;
  uid: string;
  uidMatches: boolean;
  checksumValid: boolean;
  writesAttempted: 0;
  validationErrors: readonly FirestoreBackupValidationIssue[];
  entities: Record<FirestoreBackupComparisonEntity, FirestoreBackupEntityReport>;
};

const ENTITIES: readonly FirestoreBackupComparisonEntity[] = [
  'clients',
  'deliveries',
  'factoryReceipts',
  'payments',
  'dailyData',
  'monthlyData',
  'settings/factory',
  'settings/car',
  'settings/company',
];

function emptyEntityReport(): FirestoreBackupEntityReport {
  return {
    conflicts: 0,
    different: 0,
    identical: 0,
    invalidRecords: 0,
    schemaErrors: 0,
    totalInBackup: 0,
    wouldCreate: 0,
  };
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stableValue(nested)]),
  );
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

export const firestoreBackupValuesEqual = sameValue;

function compareDocuments(
  backup: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
  current: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
): FirestoreBackupEntityReport {
  const report = emptyEntityReport();
  report.totalInBackup = Object.keys(backup).length;
  Object.entries(backup).forEach(([id, data]) => {
    const currentData = current[id];
    if (!currentData) {
      report.wouldCreate += 1;
    } else if (sameValue(data, currentData)) {
      report.identical += 1;
    } else {
      report.different += 1;
      report.conflicts += 1;
    }
  });
  return report;
}

function documentsToMap(
  documents: readonly FirestoreBackupDocument[],
): Record<string, Record<string, unknown>> {
  return Object.fromEntries(documents.map((document) => [document.id, document.data]));
}

function payloadToSnapshot(payload: FirestoreBackupPayload): FirestoreBackupSnapshot {
  return {
    clients: Object.entries(payload.appData.clients).map(([id, data]) => ({ id, data })),
    dailyData: Object.entries(payload.appData.dailyData).map(([id, data]) => ({ id, data })),
    deliveries: Object.entries(payload.appData.deliveries).map(([id, data]) => ({ id, data })),
    factoryReceipts: Object.entries(payload.appData.factoryReceipts).map(([id, value]) => ({
      data: value.data,
      id,
      payments: Object.entries(value.payments).map(([paymentId, data]) => ({
        data,
        id: paymentId,
      })),
    })),
    monthlyData: Object.entries(payload.appData.monthlyData).map(([id, data]) => ({ id, data })),
    settings: payload.appData.settings,
  };
}

function paymentsToMap(snapshot: FirestoreBackupSnapshot): Record<string, Record<string, unknown>> {
  return Object.fromEntries(
    snapshot.factoryReceipts.flatMap((receipt) =>
      receipt.payments.map((payment) => [`${receipt.id}/${payment.id}`, payment.data] as const),
    ),
  );
}

function settingsData(
  snapshot: FirestoreBackupSnapshot,
  key: 'factory' | 'car' | 'company',
): Readonly<Record<string, Readonly<Record<string, unknown>>>> {
  return snapshot.settings[key]
    ? ({ current: snapshot.settings[key] } satisfies Readonly<
        Record<string, Readonly<Record<string, unknown>>>
      >)
    : ({} satisfies Readonly<Record<string, Readonly<Record<string, unknown>>>>);
}

function issuesForEntity(
  issues: readonly FirestoreBackupValidationIssue[],
  entity: FirestoreBackupComparisonEntity,
): Pick<FirestoreBackupEntityReport, 'invalidRecords' | 'schemaErrors'> {
  const relevant = issues.filter((issue) => {
    if (!issue.path) return false;
    if (entity === 'payments') return issue.path.includes('.payments.');
    if (entity === 'factoryReceipts') return issue.path.startsWith('factoryReceipts.');
    const pathPrefix = entity.startsWith('settings/')
      ? `settings.${entity.slice('settings/'.length)}`
      : entity;
    return issue.path.startsWith(`${pathPrefix}.`);
  });
  return {
    invalidRecords: relevant.filter((issue) => issue.code === 'invalid-record').length,
    schemaErrors: relevant.filter((issue) => issue.code === 'invalid-structure').length,
  };
}

function attachIssues(
  report: FirestoreBackupEntityReport,
  issues: readonly FirestoreBackupValidationIssue[],
  entity: FirestoreBackupComparisonEntity,
): FirestoreBackupEntityReport {
  return { ...report, ...issuesForEntity(issues, entity) };
}

export function compareFirestoreBackup(
  payload: FirestoreBackupPayload,
  current: FirestoreBackupSnapshot,
  fileName: string,
  validationErrors: readonly FirestoreBackupValidationIssue[],
): FirestoreBackupDryRunReport {
  const backup = payloadToSnapshot(payload);
  const entities = {} as Record<FirestoreBackupComparisonEntity, FirestoreBackupEntityReport>;
  const pairs: readonly [FirestoreBackupComparisonEntity, FirestoreBackupEntityReport][] = [
    ['clients', compareDocuments(documentsToMap(backup.clients), documentsToMap(current.clients))],
    [
      'deliveries',
      compareDocuments(documentsToMap(backup.deliveries), documentsToMap(current.deliveries)),
    ],
    [
      'factoryReceipts',
      compareDocuments(
        Object.fromEntries(backup.factoryReceipts.map((receipt) => [receipt.id, receipt.data])),
        Object.fromEntries(current.factoryReceipts.map((receipt) => [receipt.id, receipt.data])),
      ),
    ],
    ['payments', compareDocuments(paymentsToMap(backup), paymentsToMap(current))],
    [
      'dailyData',
      compareDocuments(documentsToMap(backup.dailyData), documentsToMap(current.dailyData)),
    ],
    [
      'monthlyData',
      compareDocuments(documentsToMap(backup.monthlyData), documentsToMap(current.monthlyData)),
    ],
    [
      'settings/factory',
      compareDocuments(settingsData(backup, 'factory'), settingsData(current, 'factory')),
    ],
    ['settings/car', compareDocuments(settingsData(backup, 'car'), settingsData(current, 'car'))],
    [
      'settings/company',
      compareDocuments(settingsData(backup, 'company'), settingsData(current, 'company')),
    ],
  ];
  pairs.forEach(([entity, entityReport]) => {
    entities[entity] = attachIssues(entityReport, validationErrors, entity);
  });

  return {
    checksumValid: true,
    entities,
    fileName,
    mode: 'read-only-dry-run',
    status: validationErrors.length === 0 ? 'ready' : 'blocked',
    uid: payload.uid,
    uidMatches: true,
    validationErrors,
    writesAttempted: 0,
  };
}

export function blockedFirestoreBackupReport(
  fileName: string,
  uid: string,
  validation: {
    checksumValid: boolean;
    issues: readonly FirestoreBackupValidationIssue[];
    uidMatches: boolean;
  },
): FirestoreBackupDryRunReport {
  const entities = Object.fromEntries(
    ENTITIES.map((entity) => [
      entity,
      attachIssues(emptyEntityReport(), validation.issues, entity),
    ]),
  ) as Record<FirestoreBackupComparisonEntity, FirestoreBackupEntityReport>;
  return {
    checksumValid: validation.checksumValid,
    entities,
    fileName,
    mode: 'read-only-dry-run',
    status: 'blocked',
    uid,
    uidMatches: validation.uidMatches,
    validationErrors: validation.issues,
    writesAttempted: 0,
  };
}
