import { formatTrendPercentage } from '@/features/finance/utils/financialTrendUtils';

describe('FinancialTrendIndicator formatTrendPercentage', () => {
  it('deve formatar números positivos com 1 casa decimal e percentual', () => {
    expect(formatTrendPercentage(8.4123)).toBe('8,4%');
    expect(formatTrendPercentage(8.4)).toBe('8,4%');
    expect(formatTrendPercentage(8)).toBe('8,0%');
    expect(formatTrendPercentage(100)).toBe('100,0%');
  });

  it('deve formatar números negativos com 1 casa decimal em valor absoluto', () => {
    expect(formatTrendPercentage(-5.24)).toBe('5,2%');
    expect(formatTrendPercentage(-5.2)).toBe('5,2%');
    expect(formatTrendPercentage(-0.1)).toBe('0,1%');
  });

  it('deve retornar 0,0% para zero', () => {
    expect(formatTrendPercentage(0)).toBe('0,0%');
  });

  it('deve retornar 0,0% para valores nulos, indefinidos, NaN ou infinitos', () => {
    expect(formatTrendPercentage(null)).toBe('0,0%');
    expect(formatTrendPercentage(undefined)).toBe('0,0%');
    expect(formatTrendPercentage(Number.NaN)).toBe('0,0%');
    expect(formatTrendPercentage(Number.POSITIVE_INFINITY)).toBe('0,0%');
    expect(formatTrendPercentage(Number.NEGATIVE_INFINITY)).toBe('0,0%');
  });
});
