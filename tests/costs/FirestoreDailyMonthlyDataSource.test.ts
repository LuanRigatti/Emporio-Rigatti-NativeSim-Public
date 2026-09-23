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
  getDoc: jest.fn(async () => ({ exists: () => false })),
  getDocs: jest.fn(async () => ({ docs: [], metadata: { fromCache: false } })),
  query: jest.fn((...args: unknown[]) => ({ type: 'query', args })),
  where: jest.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  setDoc: jest.fn(async () => undefined),
  deleteDoc: jest.fn(async () => undefined),
  serverTimestamp: jest.fn(() => ({ type: 'serverTimestamp' })),
}));

const mockedGetDocs = jest.mocked(firestoreModule.getDocs);

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
