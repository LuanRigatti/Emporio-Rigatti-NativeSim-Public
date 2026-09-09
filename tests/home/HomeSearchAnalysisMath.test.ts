import {
  averageValues,
  classifyTrend,
  percentageChange,
  previousComparablePeriod,
  safeDivide,
  sumValues,
} from '@/features/home/search/HomeSearchAnalysisMath';

describe('HomeSearchAnalysisMath', () => {
  it('uses safe zero semantics for invalid or zero denominators', () => {
    expect(safeDivide(10, 2)).toBe(5);
    expect(safeDivide(10, 0)).toBe(0);
    expect(safeDivide(Number.NaN, 2)).toBe(0);
    expect(percentageChange(120, 100)).toBe(20);
    expect(percentageChange(120, 0)).toBeNull();
  });

  it('aggregates finite values deterministically', () => {
    expect(sumValues([100, Number.NaN, 50])).toBe(150);
    expect(averageValues([100, 50])).toBe(75);
    expect(averageValues([])).toBe(0);
  });

  it.each([
    [['2026-07', '2026-08', '2026-09'], 'rising'],
    [['2026-09', '2026-08', '2026-07'], 'falling'],
    [['2026-08', '2026-08'], 'stable'],
  ] as const)('classifies a monotonic series as %s', (values, direction) => {
    const points = values.map((key, index) => ({
      key,
      label: key,
      value:
        index === 0
          ? 10
          : index === 1
            ? direction === 'falling'
              ? 5
              : direction === 'rising'
                ? 20
                : 10
            : direction === 'falling'
              ? 1
              : direction === 'rising'
                ? 30
                : 10,
    }));
    expect(classifyTrend(points)).toBe(direction);
  });

  it('classifies a series with mixed movements explicitly', () => {
    expect(
      classifyTrend([
        { key: 'a', label: 'a', value: 10 },
        { key: 'b', label: 'b', value: 20 },
        { key: 'c', label: 'c', value: 15 },
      ]),
    ).toBe('mixed');
  });

  it('resolves the previous comparable calendar period', () => {
    expect(previousComparablePeriod({ kind: 'month', month: 1, year: 2026 })).toEqual({
      kind: 'month',
      month: 12,
      year: 2025,
    });
    expect(previousComparablePeriod({ kind: 'year', year: 2026 })).toEqual({
      kind: 'year',
      year: 2025,
    });
  });
});
