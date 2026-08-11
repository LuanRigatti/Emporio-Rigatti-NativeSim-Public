import {
  buildFirestoreBackupPayload,
  type FirestoreBackupSnapshot,
} from '@/services/backup/FirestoreBackupService';
import {
  FirestoreBackupRestoreService,
  type FirestoreBackupRestoreCommitResult,
  type FirestoreBackupRestoreDocument,
} from '@/services/backup/FirestoreBackupRestoreService';

jest.mock('firebase/firestore', () => ({
  Timestamp: jest.fn((mockSeconds: number, mockNanoseconds: number) => ({
    nanoseconds: mockNanoseconds,
    seconds: mockSeconds,
    toDate: () => new Date(mockSeconds * 1000),
  })),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async () => 'sha256-test'),
}));

const uid = 'firebase-user-1';

const backupSnapshot: FirestoreBackupSnapshot = {
  clients: [
    {
      data: {
        createdAt: {
          __firestoreType: 'timestamp',
          nanoseconds: 123000000,
          seconds: 1786363200,
        },
        name: 'Ana',
      },
      id: 'client-1',
    },
  ],
  dailyData: [{ data: { data: '2026-08-10', estar: 10 }, id: '2026-08-10' }],
  deliveries: [
    {
      data: {
        clientId: 'client-1',
        clientNameSnapshot: 'Ana',
        date: '2026-08-10',
        delivered: false,
        quantity: 2,
        status: 'pending',
        totalValue: 71,
      },
      id: 'delivery-1',
    },
  ],
  factoryReceipts: [
    {
      data: { completed: false, date: '2026-08-01', quantity: 10, totalValue: 350 },
      id: 'receipt-1',
      payments: [{ data: { amount: 100, date: '2026-08-02' }, id: 'payment-1' }],
    },
  ],
  monthlyData: [{ data: { luz: 20, month: '2026-08' }, id: '2026-08' }],
  settings: {
    car: { gasolineAutonomy: 10 },
    company: { tradeName: 'Empresa' },
    factory: { bucketCost: 35.5 },
  },
};

function emptySnapshot(): FirestoreBackupSnapshot {
  return {
    clients: [],
    dailyData: [],
    deliveries: [],
    factoryReceipts: [],
    monthlyData: [],
    settings: { car: null, company: null, factory: null },
  };
}

function backupContents(): string {
  const payload = buildFirestoreBackupPayload(uid, '2026-08-10T12:00:00.000Z', backupSnapshot);
  return JSON.stringify(
    {
      ...payload,
      metadata: {
        ...payload.metadata,
        checksumScope: 'payload-without-checksum',
        checksumSha256: 'sha256-test',
      },
    },
    null,
    2,
  );
}

function commitSuccess(
  operations: readonly { path: string }[],
): FirestoreBackupRestoreCommitResult {
  return {
    failedDocuments: [],
    skippedDuringCommit: 0,
    writesSucceeded: operations.length,
  };
}

function readSequence(...snapshots: FirestoreBackupSnapshot[]) {
  return jest.fn(async () => snapshots.shift() ?? emptySnapshot());
}

describe('FirestoreBackupRestoreService', () => {
  it('creates missing documents, restores timestamps and payment subcollections', async () => {
    const readSnapshot = readSequence(emptySnapshot(), emptySnapshot(), backupSnapshot);
    const commitOperations = jest.fn(
      async (_userId: string, operations: readonly FirestoreBackupRestoreDocument[]) =>
        commitSuccess(operations),
    );
    const service = new FirestoreBackupRestoreService(uid, { readSnapshot, commitOperations });
    const preparation = await service.prepare(backupContents(), 'backup.json');
    const result = await service.restore(preparation, true);

    expect(result.status).toBe('completed');
    expect(result.created).toBe(9);
    expect(result.writesAttempted).toBe(9);
    expect(result.deletionsAttempted).toBe(0);
    expect(result.postRestoreEquivalent).toBe(true);
    expect(commitOperations).toHaveBeenCalledTimes(1);

    const operations = commitOperations.mock
      .calls[0][1] as readonly FirestoreBackupRestoreDocument[];
    const payment = operations.find((operation) => operation.entity === 'payments');
    const client = operations.find((operation) => operation.entity === 'clients');
    expect(payment?.path).toBe(
      'users/firebase-user-1/factoryReceipts/receipt-1/payments/payment-1',
    );
    expect(client?.data.createdAt).toEqual({
      nanoseconds: 123000000,
      seconds: 1786363200,
      toDate: expect.any(Function),
    });
  });

  it('skips identical documents and never invokes a write for an identical backup', async () => {
    const readSnapshot = readSequence(backupSnapshot, backupSnapshot, backupSnapshot);
    const commitOperations = jest.fn(
      async (_userId: string, operations: readonly FirestoreBackupRestoreDocument[]) =>
        commitSuccess(operations),
    );
    const service = new FirestoreBackupRestoreService(uid, { readSnapshot, commitOperations });
    const preparation = await service.prepare(backupContents(), 'backup.json');
    const result = await service.restore(preparation, true);

    expect(result.status).toBe('completed');
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(9);
    expect(result.writesAttempted).toBe(0);
    expect(commitOperations).not.toHaveBeenCalled();
  });

  it('blocks conflicting documents from being overwritten', async () => {
    const conflictingSnapshot = {
      ...emptySnapshot(),
      clients: [{ data: { name: 'Nome diferente' }, id: 'client-1' }],
    };
    const readSnapshot = readSequence(conflictingSnapshot, conflictingSnapshot, backupSnapshot);
    const commitOperations = jest.fn(
      async (_userId: string, operations: readonly FirestoreBackupRestoreDocument[]) =>
        commitSuccess(operations),
    );
    const service = new FirestoreBackupRestoreService(uid, { readSnapshot, commitOperations });
    const preparation = await service.prepare(backupContents(), 'backup.json');
    const result = await service.restore(preparation, true);

    expect(preparation.report.entities.clients.conflicts).toBe(1);
    expect(result.conflicts).toBe(1);
    expect(result.created).toBe(8);
    const operations = commitOperations.mock
      .calls[0][1] as readonly FirestoreBackupRestoreDocument[];
    expect(operations.some((operation) => operation.id === 'client-1')).toBe(false);
  });

  it.each([
    ['UID diferente', backupContents().replace(uid, 'other-user')],
    ['checksum inválido', backupContents().replace('sha256-test', 'wrong-checksum')],
  ])('%s bloqueia antes de qualquer escrita', async (_name, contents) => {
    const readSnapshot = jest.fn(async () => emptySnapshot());
    const commitOperations = jest.fn(
      async (_userId: string, operations: readonly FirestoreBackupRestoreDocument[]) =>
        commitSuccess(operations),
    );
    const service = new FirestoreBackupRestoreService(uid, { readSnapshot, commitOperations });
    const preparation = await service.prepare(contents, 'backup.json');
    const result = await service.restore(preparation, true);

    expect(result.status).toBe('blocked');
    expect(result.writesAttempted).toBe(0);
    expect(commitOperations).not.toHaveBeenCalled();
  });

  it('reports partial failures with the exact failed documents and no deletions', async () => {
    const readSnapshot = readSequence(emptySnapshot(), emptySnapshot(), emptySnapshot());
    const failedDocument = {
      entity: 'clients' as const,
      error: 'permission-denied',
      id: 'client-1',
      path: 'users/firebase-user-1/clients/client-1',
    };
    const commitOperations = jest.fn(async () => ({
      failedDocuments: [failedDocument],
      skippedDuringCommit: 0,
      writesSucceeded: 8,
    }));
    const service = new FirestoreBackupRestoreService(uid, { readSnapshot, commitOperations });
    const preparation = await service.prepare(backupContents(), 'backup.json');
    const result = await service.restore(preparation, true);

    expect(result.status).toBe('partial-failure');
    expect(result.failed).toBe(1);
    expect(result.failedDocuments).toEqual([failedDocument]);
    expect(result.deletionsAttempted).toBe(0);
    expect(result.postRestoreEquivalent).toBe(false);
  });

  it('requires explicit confirmation and performs no write when cancelled', async () => {
    const readSnapshot = readSequence(emptySnapshot());
    const commitOperations = jest.fn(
      async (_userId: string, operations: readonly FirestoreBackupRestoreDocument[]) =>
        commitSuccess(operations),
    );
    const service = new FirestoreBackupRestoreService(uid, { readSnapshot, commitOperations });
    const preparation = await service.prepare(backupContents(), 'backup.json');
    const result = await service.restore(preparation, false);

    expect(result.status).toBe('blocked');
    expect(result.deletionsAttempted).toBe(0);
    expect(commitOperations).not.toHaveBeenCalled();
  });
});
