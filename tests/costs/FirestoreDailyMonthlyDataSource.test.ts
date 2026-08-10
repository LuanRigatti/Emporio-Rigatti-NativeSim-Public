import {
  costValuesToDailyDocument,
  costValuesToMonthlyDocument,
  dailyDocumentToExpense,
  dailyExpenseToCostValues,
  monthlyDocumentToExpense,
  snapshotToCostSettings,
} from '@/services/costs/FirestoreDailyMonthlyDataSource';
import { expenseQueryForFinancialSelection } from '@/services/costs/financialExpenseQuery';

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
});
