import {
  buildFirestoreBackupPayload,
  type FirestoreBackupSnapshot,
} from '@/services/backup/FirestoreBackupService';
import { FirestoreBackupDryRunService } from '@/services/backup/FirestoreBackupDryRunService';
import { deserializeFirestoreValue } from '@/services/backup/FirestoreBackupValidationService';

jest.mock('firebase/firestore', () => ({
  Timestamp: jest.fn((mockSeconds: number, mockNanoseconds: number) => ({
    seconds: mockSeconds,
    nanoseconds: mockNanoseconds,
  })),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async () => 'sha256-test'),
}));

const uid = 'firebase-user-1';

const backupSnapshot: FirestoreBackupSnapshot = {
  clients: [{ data: { name: 'Ana', usesInvoice: true }, id: 'client-1' }],
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

function backupContents(
  overrides: {
    metadata?: Record<string, unknown>;
    schemaVersion?: unknown;
    uid?: unknown;
  } = {},
): string {
  const payload = buildFirestoreBackupPayload(uid, '2026-08-10T12:00:00.000Z', backupSnapshot);
  const withChecksum = {
    ...payload,
    ...overrides,
    metadata: {
      ...payload.metadata,
      checksumScope: 'payload-without-checksum',
      checksumSha256: 'sha256-test',
      ...overrides.metadata,
    },
  };
  return JSON.stringify(withChecksum, null, 2);
}

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

describe('FirestoreBackupDryRunService', () => {
  it('validates and compares all entities without attempting a Firestore write', async () => {
    const readSnapshot = jest.fn(async () => emptySnapshot());
    const report = await new FirestoreBackupDryRunService(uid, { readSnapshot }).run(
      backupContents(),
      'backup.json',
    );

    expect(report.status).toBe('ready');
    expect(report.writesAttempted).toBe(0);
    expect(readSnapshot).toHaveBeenCalledTimes(1);
    expect(report.entities.clients.wouldCreate).toBe(1);
    expect(report.entities.deliveries.wouldCreate).toBe(1);
    expect(report.entities.factoryReceipts.wouldCreate).toBe(1);
    expect(report.entities.payments.wouldCreate).toBe(1);
    expect(report.entities.dailyData.wouldCreate).toBe(1);
    expect(report.entities.monthlyData.wouldCreate).toBe(1);
    expect(report.entities['settings/company'].wouldCreate).toBe(1);
  });

  it('classifies identical documents as skip and different documents as conflict', async () => {
    const current = {
      ...backupSnapshot,
      deliveries: [{ ...backupSnapshot.deliveries[0] }],
      clients: [
        {
          data: { ...backupSnapshot.clients[0].data, name: 'Outra Ana' },
          id: backupSnapshot.clients[0].id,
        },
      ],
    };
    current.deliveries[0].data = { ...current.deliveries[0].data };

    const report = await new FirestoreBackupDryRunService(uid, {
      readSnapshot: async () => current,
    }).run(backupContents(), 'backup.json');

    expect(report.entities.deliveries.identical).toBe(1);
    expect(report.entities.clients.different).toBe(1);
    expect(report.entities.clients.conflicts).toBe(1);
  });

  it.each([
    ['JSON corrompido', '{', 'invalid-json'],
    [
      'checksum inválido',
      backupContents({ metadata: { checksumSha256: 'wrong' } }),
      'invalid-checksum',
    ],
    ['schema incompatível', backupContents({ schemaVersion: 2 }), 'unsupported-schema-version'],
    ['UID diferente', backupContents({ uid: 'other-user' }), 'uid-mismatch'],
  ])('%s bloqueia a comparação sem ler o Firestore', async (_name, contents, code) => {
    const readSnapshot = jest.fn(async () => emptySnapshot());
    const report = await new FirestoreBackupDryRunService(uid, { readSnapshot }).run(
      contents,
      'backup.json',
    );

    expect(report.status).toBe('blocked');
    expect(report.writesAttempted).toBe(0);
    expect(report.validationErrors.some((issue) => issue.code === code)).toBe(true);
    expect(readSnapshot).not.toHaveBeenCalled();
  });

  it('restores serialized timestamps in memory without converting them to strings', () => {
    const value = deserializeFirestoreValue({
      __firestoreType: 'timestamp',
      nanoseconds: 123000000,
      seconds: 1786363200,
    });

    expect(value).toEqual({ seconds: 1786363200, nanoseconds: 123000000 });
  });
});
