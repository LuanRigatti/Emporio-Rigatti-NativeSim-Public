import * as firestoreModule from 'firebase/firestore';

import {
  FirestoreFactoryReceiptDataSource,
  setFirestoreFactoryReceiptDataSourceOpsForTesting,
} from '@/services/factory-purchases/FirestoreFactoryReceiptDataSource';
import type { FactoryReceipt } from '@/types/data';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
  },
}));

jest.mock('@/services/firebase/firestore', () => ({
  __esModule: true,
  getFirebaseFirestore: jest.fn(() => ({})),
}));

jest.mock('firebase/firestore', () => ({
  __esModule: true,
  collection: jest.fn((...args: unknown[]) => ({ path: args.join('/') })),
  getDocs: jest.fn(),
  query: jest.fn((...args: unknown[]) => ({ type: 'query', args })),
  where: jest.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
}));

const mockedGetDocs = jest.mocked(firestoreModule.getDocs);

describe('FirestoreFactoryReceiptDataSource - session isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setFirestoreFactoryReceiptDataSourceOpsForTesting(firestoreModule, {});
  });

  afterAll(() => {
    setFirestoreFactoryReceiptDataSourceOpsForTesting(undefined);
  });

  it('ignores a restore request for a previous session', async () => {
    const dataSource = new FirestoreFactoryReceiptDataSource();
    dataSource.setSessionUser('uid-old');
    dataSource.setSessionUser();

    await expect(dataSource.restore('uid-old')).resolves.toBeUndefined();
    expect(mockedGetDocs).not.toHaveBeenCalled();
    expect(dataSource.getReceipts()).toEqual([]);
  });

  it('does not apply a pending restore after logout or user change', async () => {
    let resolveFirestore: (
      value: Awaited<ReturnType<typeof firestoreModule.getDocs>>,
    ) => void = () => undefined;
    const pendingFirestore = new Promise<Awaited<ReturnType<typeof firestoreModule.getDocs>>>(
      (resolve) => {
        resolveFirestore = resolve;
      },
    );
    mockedGetDocs.mockReturnValueOnce(pendingFirestore);

    const dataSource = new FirestoreFactoryReceiptDataSource();
    dataSource.setSessionUser('uid-old');
    const restorePromise = dataSource.restore('uid-old');
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(mockedGetDocs).toHaveBeenCalledTimes(1);

    dataSource.setSessionUser('uid-new');
    resolveFirestore({ empty: true, docs: [] } as unknown as Awaited<
      ReturnType<typeof firestoreModule.getDocs>
    >);

    await expect(restorePromise).resolves.toBeUndefined();
    expect(dataSource.getReceipts('uid-new')).toEqual([]);
  });

  it('preserves an existing receipt when Firestore returns empty fromCache data', async () => {
    const existingReceipt: FactoryReceipt = {
      id: 'receipt-existing',
      quantidade: 2,
      data: '2026-08-20',
      precoUnitarioHistorico: 50,
      valorTotal: 100,
      concluido: false,
      pagamentos: [],
    };
    const dataSource = new FirestoreFactoryReceiptDataSource();
    dataSource.setSessionUser('uid-test');
    const receipts = (dataSource as unknown as { receipts: Map<string, FactoryReceipt> }).receipts;
    receipts.set(existingReceipt.id, existingReceipt);
    mockedGetDocs.mockResolvedValueOnce({
      empty: true,
      metadata: { fromCache: true },
      docs: [],
    } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);

    await dataSource.restore('uid-test');

    expect(dataSource.getReceipts('uid-test')).toEqual([existingReceipt]);
    expect(dataSource.isDataUnavailable).toBe(false);
  });

  it('marks empty fromCache factory data as unavailable instead of as a real empty list', async () => {
    const dataSource = new FirestoreFactoryReceiptDataSource();
    dataSource.setSessionUser('uid-test');
    mockedGetDocs.mockResolvedValueOnce({
      empty: true,
      metadata: { fromCache: true },
      docs: [],
    } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);

    await dataSource.restore('uid-test');

    expect(dataSource.getReceipts('uid-test')).toEqual([]);
    expect(dataSource.isDataUnavailable).toBe(true);
  });

  it('clears the same uid when the session version changes', () => {
    const dataSource = new FirestoreFactoryReceiptDataSource();
    dataSource.setSessionUser('uid-test', 1);
    const receipts = (dataSource as unknown as { receipts: Map<string, FactoryReceipt> }).receipts;
    receipts.set('receipt-session', {
      id: 'receipt-session',
      quantidade: 1,
      data: '2026-08-20',
      precoUnitarioHistorico: 50,
      valorTotal: 50,
      concluido: false,
      pagamentos: [],
    });

    dataSource.setSessionUser('uid-test', 2);

    expect(dataSource.getReceipts('uid-test', 2)).toEqual([]);
  });
});
