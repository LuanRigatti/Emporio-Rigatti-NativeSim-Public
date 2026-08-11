import {
  buildFirestoreBackupPayload,
  countFirestoreBackupSnapshot,
  FirestoreBackupService,
  serializeFirestoreValue,
} from '@/services/backup/FirestoreBackupService';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async () => 'sha256-test'),
}));

describe('FirestoreBackupService', () => {
  const snapshot = {
    clients: [{ id: 'client-1', data: { name: 'Ana', currentUnitPrice: 35.5 } }],
    dailyData: [{ id: '2026-08-10', data: { data: '2026-08-10', estar: 10 } }],
    deliveries: [{ id: 'delivery-1', data: { totalValue: 71, unitPriceHistorical: 35.5 } }],
    factoryReceipts: [
      {
        data: { date: '2026-08-01', totalValue: 100 },
        id: 'receipt-1',
        payments: [{ id: 'payment-1', data: { amount: 50 } }],
      },
    ],
    monthlyData: [{ id: '2026-08', data: { month: '2026-08', luz: 20 } }],
    settings: {
      car: { gasolineAutonomy: '10' },
      company: { tradeName: 'Empresa' },
      factory: { bucketCost: '35.50' },
    },
  } as const;

  it('preserves document IDs, payments, numeric values and counts', () => {
    const payload = buildFirestoreBackupPayload(
      'firebase-user-1',
      '2026-08-10T12:00:00.000Z',
      snapshot,
    );

    expect(payload.appData.clients['client-1'].currentUnitPrice).toBe(35.5);
    expect(payload.appData.deliveries['delivery-1'].unitPriceHistorical).toBe(35.5);
    expect(payload.appData.factoryReceipts['receipt-1'].payments['payment-1'].amount).toBe(50);
    expect(payload.metadata.counts).toEqual({
      clients: 1,
      deliveries: 1,
      factoryPayments: 1,
      factoryReceipts: 1,
      dailyData: 1,
      monthlyData: 1,
      settings: { car: 1, company: 1, factory: 1 },
    });
  });

  it('serializes Firestore timestamps reversibly without converting them to strings', () => {
    const timestamp = {
      nanoseconds: 123000000,
      seconds: 1786363200,
      toDate: () => new Date(1786363200000),
    };

    expect(serializeFirestoreValue(timestamp)).toEqual({
      __firestoreType: 'timestamp',
      nanoseconds: 123000000,
      seconds: 1786363200,
    });
  });

  it('counts factory payments independently from receipts', () => {
    expect(countFirestoreBackupSnapshot(snapshot).factoryPayments).toBe(1);
  });

  it('validates the JSON/counts before sharing and releases the temporary file', async () => {
    const shareFile = jest.fn(async () => undefined);
    const releaseFile = jest.fn();
    const result = await new FirestoreBackupService('firebase-user-1', {
      createFile: async (json, fileName) => {
        expect(() => JSON.parse(json)).not.toThrow();
        return { fileName, sizeBytes: json.length, uri: 'file:///backup.json' };
      },
      readSnapshot: async () => snapshot,
      releaseFile,
      shareFile,
    }).exportBackup();

    expect(result.checksumSha256).toBe('sha256-test');
    expect(result.counts.deliveries).toBe(1);
    expect(shareFile).toHaveBeenCalledTimes(1);
    expect(releaseFile).toHaveBeenCalledTimes(1);
  });
});
