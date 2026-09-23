import {
  financialFiltersForSelection,
  formatWholesaleFinancePeriodLabel,
  formatFinancialSeriesLabel,
  formatFinancialPeriodLabel,
  selectionFromReportPeriod,
  wholesaleFinanceFiltersForSelection,
  wholesaleFinanceSelectionToFinancialSelection,
} from '@/services/finance/FinancialPeriodService';
import {
  formatOperationalDate,
  formatPtBrCompactMonthYear,
  formatPtBrDate,
  formatPtBrMonthYear,
} from '@/utils/data';

describe('FinancialPeriodService', () => {
  it('creates an explicit month selection without silently changing the requested month', () => {
    const selection = selectionFromReportPeriod('month', '2026-07-24');
    expect(selection).toEqual({ kind: 'month', month: '2026-07' });
    expect(financialFiltersForSelection({ kind: 'month', month: '2025-02' })).toEqual({
      periodo: 'mes',
      mesSelecionado: '2025-02',
    });
  });

  it('limits a year selection to the selected year', () => {
    expect(financialFiltersForSelection({ kind: 'year', year: '2024' })).toEqual({
      periodo: 'range',
      dataInicioSelecionada: '2024-01-01',
      dataFimSelecionada: '2024-12-31',
    });
  });

  it('supports all periods and custom ranges', () => {
    expect(financialFiltersForSelection({ kind: 'all' })).toEqual({ periodo: 'todos' });
    expect(
      financialFiltersForSelection({ kind: 'range', start: '2026-01-01', end: '2026-03-31' }),
    ).toEqual({
      periodo: 'range',
      dataInicioSelecionada: '2026-01-01',
      dataFimSelecionada: '2026-03-31',
    });
    expect(formatFinancialPeriodLabel({ kind: 'month', month: '2026-07' })).toBe('Julho 2026');
  });

  it('maps Wholesale month, day and all selections to the existing filters', () => {
    expect(wholesaleFinanceFiltersForSelection({ kind: 'month', month: '2026-07' })).toEqual({
      periodo: 'mes',
      mesSelecionado: '2026-07',
    });
    expect(wholesaleFinanceFiltersForSelection({ kind: 'day', date: '2026-07-24' })).toEqual({
      periodo: 'dia',
      diaSelecionado: '2026-07-24',
    });
    expect(wholesaleFinanceFiltersForSelection({ kind: 'all' })).toEqual({ periodo: 'todos' });
  });

  it('maps a Wholesale week to the exact History range instead of a weekday week', () => {
    const selection = { kind: 'week' as const, startDate: '2026-07-08', endDate: '2026-07-14' };

    expect(wholesaleFinanceSelectionToFinancialSelection(selection)).toEqual({
      kind: 'range',
      start: '2026-07-08',
      end: '2026-07-14',
    });
    expect(wholesaleFinanceFiltersForSelection(selection)).toEqual({
      periodo: 'range',
      dataInicioSelecionada: '2026-07-08',
      dataFimSelecionada: '2026-07-14',
    });
    expect(formatWholesaleFinancePeriodLabel(selection)).toBe('8–14 Jul');
  });

  it('formats technical dates for the interface without changing their ISO values', () => {
    expect(formatPtBrMonthYear('2026-07')).toBe('Julho 2026');
    expect(formatPtBrCompactMonthYear('2026-07')).toBe('Jul/26');
    expect(formatPtBrDate('2026-07-25')).toBe('25/07/2026');
    expect(formatOperationalDate('2026-07-25', '2026-07-25')).toBe('Hoje, 25 de julho');
  });

  it('uses compact labels for financial series', () => {
    expect(formatFinancialSeriesLabel('2026-07', 'month')).toBe('Jul/26');
  });
});
