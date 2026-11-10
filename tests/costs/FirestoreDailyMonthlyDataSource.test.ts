import * as firestoreModule from 'firebase/firestore';

import {
  FirestoreDailyMonthlyDataSource,
  costValuesToDailyDocument,
  costValuesToDailyPatchDocument,
  costValuesToMonthlyDocument,
  dailyDocumentToExpense,
  dailyExpenseToCostValues,
  monthlyDocumentToExpense,
  snapshotToCostSettings,
} from '@/services/costs/FirestoreDailyMonthlyDataSource';
import {
  expenseQueryForFinancialSelection,
  expenseQueryForWholesaleFinanceSelection,
} from '@/services/costs/financialExpenseQuery';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@/services/firebase/firestore', () => ({
  __esModule: true,
  getFirebaseFirestore: jest.fn(() => ({})),
}));

jest.mock('firebase/firestore', () => ({
  __esModule: true,
  collection: jest.fn((...args: unknown[]) => ({ path: args.join('/') })),
  doc: jest.fn((...args: unknown[]) => ({ path: args.join('/') })),
  getDoc: jest.fn(async () => ({
    exists: () => false,
    metadata: { fromCache: false, hasPendingWrites: false },
  })),
  getDocs: jest.fn(async () => ({
    docs: [],
    metadata: { fromCache: false, hasPendingWrites: false },
  })),
  query: jest.fn((...args: unknown[]) => ({ type: 'query', args })),
  where: jest.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  setDoc: jest.fn(async () => undefined),
  deleteDoc: jest.fn(async () => undefined),
  serverTimestamp: jest.fn(() => ({ type: 'serverTimestamp' })),
}));

const mockedGetDocs = jest.mocked(firestoreModule.getDocs);
const mockedGetDoc = jest.mocked(firestoreModule.getDoc);

const values = {
  estar: '10',
  fuel: '20',
  fuelPrice: '6.59',
  fuelType: 'gasolina',
  kilometers: '12.5',
  light: '',
  other: '4',
};

describe('Firestore daily/monthly cost documents', () => {
  it('uses the date and month as stable document identities without arrays', () => {
    expect(costValuesToDailyDocument('2026-08-06', values)).toMatchObject({
      data: '2026-08-06',
      estar: 10,
      km: 12.5,
      outros: 4,
      precoGasolina: 6.59,
    });
    expect(costValuesToMonthlyDocument('2026-08', { ...values, light: '100' })).toEqual({
      month: '2026-08',
      luz: 100,
    });
    expect(JSON.stringify(values)).not.toContain('samples');
  });

  it('marks cleared daily fields for deletion instead of leaving stale Firestore values', () => {
    expect(
      costValuesToDailyPatchDocument(
        '2026-08-09',
        { ...values, estar: '', fuel: '', fuelPrice: '', fuelType: '', kilometers: '', other: '' },
        ['estar', 'fuel', 'fuelPrice', 'fuelType', 'kilometers', 'other'],
        () => 'DELETE_FIELD',
      ),
    ).toEqual({
      data: '2026-08-09',
      estar: 'DELETE_FIELD',
      gasolina: 'DELETE_FIELD',
      km: 'DELETE_FIELD',
      outros: 'DELETE_FIELD',
      precoGasolina: 'DELETE_FIELD',
      tipoCombustivel: 'DELETE_FIELD',
    });
  });

  it('preserves current fuel price as a replacement and keeps other manual fields', () => {
    const expense = dailyDocumentToExpense('2026-08-06', {
      data: '2026-08-06',
      estar: 10,
      gasolina: 20,
      km: 12.5,
      outros: 4,
      precoGasolina: 6.69,
      tipoCombustivel: 'gasolina',
      legacyFields: { imported: true },
    });

    expect(expense).toMatchObject({
      gasolina: 20,
      km: 12.5,
      outros: 4,
      precoGasolina: 6.69,
      legacyFields: { imported: true },
    });
    expect(dailyExpenseToCostValues(expense).fuelPrice).toBe('6.69');
  });

  it('maps one independent monthly document without inventing history', () => {
    expect(
      monthlyDocumentToExpense({ month: '2026-08', luz: 125, legacyFields: { source: 'manual' } }),
    ).toEqual({
      luz: 125,
      legacyFields: { source: 'manual' },
    });
  });

  it('converts a granular snapshot to the existing calculation contract', () => {
    const settings = snapshotToCostSettings({
      gastosDiarios: {
        '2026-08-06': dailyDocumentToExpense('2026-08-06', { data: '2026-08-06', outros: 4 }),
      },
      gastosMensais: { '2026-08': monthlyDocumentToExpense({ luz: 125 }) },
    });

    expect(settings.periods.day['2026-08-06'].other).toBe('4');
    expect(settings.periods.month['2026-08'].light).toBe('125');
    expect(settings.periods.year).toEqual({});
  });

  it('propagates cache metadata for all-time reads without changing load()', async () => {
    mockedGetDocs
      .mockResolvedValueOnce({
        docs: [
          {
            id: '2026-08-06',
            exists: () => true,
            data: () => ({ data: '2026-08-06', estar: 10 }),
          },
        ],
        metadata: { fromCache: false },
      } as never)
      .mockResolvedValueOnce({
        docs: [
          {
            id: '2026-08',
            exists: () => true,
            data: () => ({ month: '2026-08', luz: 125 }),
          },
        ],
        metadata: { fromCache: true },
      } as never);

    const dataSource = new FirestoreDailyMonthlyDataSource();
    const result = await dataSource.loadWithMetadata('uid-test', { loadAll: true });

    expect(result.snapshot.gastosDiarios['2026-08-06']).toMatchObject({ estar: 10 });
    expect(result.snapshot.gastosMensais['2026-08']).toMatchObject({ luz: 125 });
    expect(result.source).toBe('cache');
    expect(result.remoteComplete).toBe(false);
    expect(mockedGetDocs).toHaveBeenCalledTimes(2);
  });

  it('rejects a cache-only full snapshot as the basis for a cost mutation', async () => {
    mockedGetDocs
      .mockResolvedValueOnce({ docs: [], metadata: { fromCache: true } } as never)
      .mockResolvedValueOnce({ docs: [], metadata: { fromCache: false } } as never);

    const dataSource = new FirestoreDailyMonthlyDataSource();
    await expect(dataSource.loadAllAsCostSettings('uid-test')).rejects.toThrow('incompleto');
  });

  it('rejects a snapshot with unacknowledged Firestore writes as complete', async () => {
    mockedGetDocs
      .mockResolvedValueOnce({
        docs: [],
        metadata: { fromCache: false, hasPendingWrites: true },
      } as never)
      .mockResolvedValueOnce({
        docs: [],
        metadata: { fromCache: false, hasPendingWrites: false },
      } as never);

    const dataSource = new FirestoreDailyMonthlyDataSource();
    await expect(dataSource.loadAllAsCostSettings('uid-test')).rejects.toThrow('incompleto');
  });

  it('starts daily and monthly reads together for a selected month', async () => {
    let resolveDaily: ((value: never) => void) | undefined;
    let resolveMonthly: ((value: never) => void) | undefined;
    mockedGetDocs.mockImplementationOnce(
      () => new Promise((resolve) => (resolveDaily = resolve)) as never,
    );
    mockedGetDoc.mockImplementationOnce(
      () => new Promise((resolve) => (resolveMonthly = resolve)) as never,
    );

    const dataSource = new FirestoreDailyMonthlyDataSource();
    const load = dataSource.loadWithMetadata('uid-test', { month: '2026-08' });

    expect(mockedGetDocs).toHaveBeenCalledTimes(1);
    expect(mockedGetDoc).toHaveBeenCalledTimes(1);

    resolveDaily?.({
      docs: [],
      metadata: { fromCache: false, hasPendingWrites: false },
    } as never);
    resolveMonthly?.({
      exists: () => false,
      metadata: { fromCache: false, hasPendingWrites: false },
    } as never);
    await expect(load).resolves.toMatchObject({
      remoteComplete: true,
      snapshot: { gastosDiarios: {}, gastosMensais: {} },
      source: 'network',
    });
  });

  it('confirms an exact monthly cost query only with both metadata flags and session scope', async () => {
    mockedGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: '2026-08-06',
          exists: () => true,
          data: () => ({ data: '2026-08-06', estar: 10 }),
        },
      ],
      metadata: { fromCache: false, hasPendingWrites: false },
    } as never);
    mockedGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: '2026-08',
      data: () => ({ month: '2026-08', luz: 125 }),
      metadata: { fromCache: false, hasPendingWrites: false },
    } as never);

    const dataSource = new FirestoreDailyMonthlyDataSource();
    const result = await dataSource.loadWithMetadata(
      'uid-test',
      { month: '2026-08' },
      { sessionVersion: 17 },
    );

    expect(result.provenance).toMatchObject({
      uid: 'uid-test',
      sessionVersion: 17,
      scope: { month: '2026-08' },
      origin: 'server',
      fromCache: false,
      hasPendingWrites: false,
      coverage: 'complete',
      remoteConfirmed: true,
    });
    expect(result.querySnapshot).toEqual({
      gastosDiarios: { '2026-08-06': expect.objectContaining({ estar: 10 }) },
      gastosMensais: { '2026-08': expect.objectContaining({ luz: 125 }) },
    });
  });

  it('labels cache-only and pending-write month results without remote confirmation', async () => {
    mockedGetDocs
      .mockResolvedValueOnce({
        docs: [],
        metadata: { fromCache: true, hasPendingWrites: false },
      } as never)
      .mockResolvedValueOnce({
        docs: [],
        metadata: { fromCache: false, hasPendingWrites: true },
      } as never);
    mockedGetDoc
      .mockResolvedValueOnce({
        exists: () => false,
        metadata: { fromCache: true, hasPendingWrites: false },
      } as never)
      .mockResolvedValueOnce({
        exists: () => false,
        metadata: { fromCache: false, hasPendingWrites: true },
      } as never);

    const dataSource = new FirestoreDailyMonthlyDataSource();
    const cacheResult = await dataSource.loadWithMetadata('uid-test', { month: '2026-08' });
    const pendingResult = await dataSource.loadWithMetadata('uid-test', { month: '2026-09' });

    expect(cacheResult.provenance).toMatchObject({ origin: 'cache', remoteConfirmed: false });
    expect(pendingResult.provenance).toMatchObject({
      origin: 'local-pending',
      hasPendingWrites: true,
      remoteConfirmed: false,
    });
  });

  it('does not classify an unknown query scope or missing metadata as complete', async () => {
    mockedGetDocs.mockResolvedValueOnce({ docs: [] } as never);
    mockedGetDoc.mockResolvedValueOnce({ exists: () => false } as never);

    const dataSource = new FirestoreDailyMonthlyDataSource();
    const result = await dataSource.loadWithMetadata('uid-test', {});

    expect(result.provenance).toMatchObject({
      origin: 'unknown',
      coverage: 'unknown',
      fromCache: null,
      hasPendingWrites: null,
      remoteConfirmed: false,
    });
  });

  it('keeps a confirmed empty query separate from rows retained by the compatibility store', async () => {
    mockedGetDocs
      .mockResolvedValueOnce({
        docs: [
          {
            id: '2026-08-06',
            exists: () => true,
            data: () => ({ data: '2026-08-06', estar: 10 }),
          },
        ],
        metadata: { fromCache: false, hasPendingWrites: false },
      } as never)
      .mockResolvedValueOnce({
        docs: [],
        metadata: { fromCache: false, hasPendingWrites: false },
      } as never);
    mockedGetDoc
      .mockResolvedValueOnce({
        exists: () => false,
        metadata: { fromCache: false, hasPendingWrites: false },
      } as never)
      .mockResolvedValueOnce({
        exists: () => false,
        metadata: { fromCache: false, hasPendingWrites: false },
      } as never);

    const dataSource = new FirestoreDailyMonthlyDataSource();
    await dataSource.loadWithMetadata('uid-test', { month: '2026-08' });
    const confirmedEmpty = await dataSource.loadWithMetadata('uid-test', { month: '2026-08' });

    expect(confirmedEmpty.provenance.remoteConfirmed).toBe(true);
    expect(confirmedEmpty.querySnapshot.gastosDiarios).toEqual({});
    expect(confirmedEmpty.snapshot.gastosDiarios['2026-08-06']).toMatchObject({ estar: 10 });
  });

  it('returns a stale unknown result if the owning session ends during a read', async () => {
    let resolveDaily: ((value: never) => void) | undefined;
    let resolveMonthly: ((value: never) => void) | undefined;
    let canRun = true;
    mockedGetDocs.mockImplementationOnce(
      () => new Promise((resolve) => (resolveDaily = resolve)) as never,
    );
    mockedGetDoc.mockImplementationOnce(
      () => new Promise((resolve) => (resolveMonthly = resolve)) as never,
    );

    const dataSource = new FirestoreDailyMonthlyDataSource();
    const load = dataSource.loadWithMetadata(
      'uid-test',
      { month: '2026-08' },
      { sessionVersion: 21, canRun: () => canRun },
    );
    canRun = false;
    resolveDaily?.({ docs: [], metadata: { fromCache: false, hasPendingWrites: false } } as never);
    resolveMonthly?.({
      exists: () => false,
      metadata: { fromCache: false, hasPendingWrites: false },
    } as never);

    await expect(load).resolves.toMatchObject({
      remoteComplete: false,
      provenance: { origin: 'stale', remoteConfirmed: false, sessionVersion: 21 },
    });
  });

  it('propagates an offline read failure without creating confirmed coverage', async () => {
    mockedGetDocs.mockRejectedValueOnce(new Error('synthetic offline failure'));

    const dataSource = new FirestoreDailyMonthlyDataSource();
    await expect(
      dataSource.loadWithMetadata('uid-test', { month: '2026-08' }, { sessionVersion: 22 }),
    ).rejects.toThrow('synthetic offline failure');
  });

  it('builds period-bounded queries instead of requesting all cost documents', () => {
    expect(expenseQueryForFinancialSelection({ kind: 'day', date: '2026-08-06' })).toEqual({
      date: '2026-08-06',
    });
    expect(expenseQueryForFinancialSelection({ kind: 'month', month: '2026-07' })).toMatchObject({
      startDate: '2026-06-01',
      endDate: '2026-07-31',
    });
    expect(expenseQueryForFinancialSelection({ kind: 'all' })).toEqual({ loadAll: true });
  });

  it('uses the History range for Wholesale weeks and keeps all-time as a pure query contract', () => {
    expect(expenseQueryForWholesaleFinanceSelection({ kind: 'month', month: '2026-07' })).toEqual({
      startDate: '2026-06-01',
      endDate: '2026-07-31',
    });
    expect(expenseQueryForWholesaleFinanceSelection({ kind: 'day', date: '2026-08-06' })).toEqual({
      date: '2026-08-06',
    });
    expect(
      expenseQueryForWholesaleFinanceSelection({
        kind: 'week',
        startDate: '2026-07-08',
        endDate: '2026-07-14',
      }),
    ).toEqual({ startDate: '2026-07-08', endDate: '2026-07-14' });
    expect(expenseQueryForWholesaleFinanceSelection({ kind: 'all' })).toEqual({ loadAll: true });
  });
});
