import {
  createFinanceWidgetTimeline,
  formatFinanceWidgetAmount,
  getFinanceWidgetMonthKey,
  getFinanceWidgetMonthLabel,
  unavailableFinanceWidgetProps,
  type ResumoFinanceiroWidgetProps,
} from '@/features/finance/widgets/ResumoFinanceiroSnapshot';
import { formatCurrency } from '@/utils/data';

function isPropertyListValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isPropertyListValue);
  if (typeof value !== 'object') return false;

  return (
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.values(value).every(isPropertyListValue)
  );
}

function makeSnapshot(
  wholesale: ResumoFinanceiroWidgetProps['wholesale'],
  retail: ResumoFinanceiroWidgetProps['retail'],
): ResumoFinanceiroWidgetProps {
  return {
    monthKey: '2026-10',
    monthLabel: 'OUTUBRO 2026',
    wholesale,
    retail,
  };
}

describe('ResumoFinanceiro widget snapshot', () => {
  it('formats the current month label in Portuguese', () => {
    expect(getFinanceWidgetMonthKey(new Date(2026, 9, 15))).toBe('2026-10');
    expect(getFinanceWidgetMonthLabel('2026-10')).toBe('OUTUBRO 2026');
  });

  it('keeps a real zero distinct from unavailable data', () => {
    expect(formatFinanceWidgetAmount(0)).toBe(formatCurrency(0));
    expect(formatFinanceWidgetAmount(null)).toBeNull();
    expect(formatFinanceWidgetAmount(Number.NaN)).toBeNull();
  });

  it('omits unavailable metrics from both current and next-month entries', () => {
    const now = new Date(2026, 9, 15, 10, 30);
    const current = unavailableFinanceWidgetProps('2026-10');
    const timeline = createFinanceWidgetTimeline(current, now);

    expect(timeline).toHaveLength(2);
    expect(timeline[0]).toEqual({
      date: now,
      props: {
        monthKey: '2026-10',
        monthLabel: 'OUTUBRO 2026',
        wholesale: {},
        retail: {},
      },
    });
    expect(timeline[1]?.date).toEqual(new Date(2026, 10, 1));
    expect(timeline[1]?.props).toEqual({
      monthKey: '2026-11',
      monthLabel: 'NOVEMBRO 2026',
      wholesale: {},
      retail: {},
    });
  });

  it('preserves partial and complete metrics while omitting only unavailable fields', () => {
    const partialTimeline = createFinanceWidgetTimeline(
      makeSnapshot(
        { faturamento: formatCurrency(1234.56), lucroLiquido: null },
        { faturamento: null, lucroLiquido: formatCurrency(789.01) },
      ),
      new Date(2026, 9, 15, 10, 30),
    );

    expect(partialTimeline[0]?.props.wholesale).toEqual({
      faturamento: formatCurrency(1234.56),
    });
    expect(partialTimeline[0]?.props.retail).toEqual({ lucroLiquido: formatCurrency(789.01) });
    expect(partialTimeline[1]?.props.wholesale).toEqual({});
    expect(partialTimeline[1]?.props.retail).toEqual({});

    const completeTimeline = createFinanceWidgetTimeline(
      makeSnapshot(
        { faturamento: formatCurrency(1234.56), lucroLiquido: formatCurrency(600) },
        { faturamento: formatCurrency(789.01), lucroLiquido: formatCurrency(300) },
      ),
      new Date(2026, 9, 15, 10, 30),
    );

    expect(completeTimeline[0]?.props.wholesale).toEqual({
      faturamento: formatCurrency(1234.56),
      lucroLiquido: formatCurrency(600),
    });
    expect(completeTimeline[0]?.props.retail).toEqual({
      faturamento: formatCurrency(789.01),
      lucroLiquido: formatCurrency(300),
    });
  });

  it('preserves a valid zero after formatting', () => {
    const timeline = createFinanceWidgetTimeline(
      makeSnapshot(
        { faturamento: formatFinanceWidgetAmount(0), lucroLiquido: null },
        { faturamento: null, lucroLiquido: formatFinanceWidgetAmount(0) },
      ),
      new Date(2026, 9, 15, 10, 30),
    );

    expect(timeline[0]?.props.wholesale.faturamento).toBe(formatCurrency(0));
    expect(timeline[0]?.props.retail.lucroLiquido).toBe(formatCurrency(0));
  });

  it('keeps both entries recursively property-list compatible', () => {
    const snapshots = [
      unavailableFinanceWidgetProps('2026-10'),
      makeSnapshot(
        { faturamento: formatCurrency(1234.56), lucroLiquido: null },
        { faturamento: null, lucroLiquido: formatCurrency(789.01) },
      ),
      makeSnapshot(
        { faturamento: formatCurrency(1234.56), lucroLiquido: formatCurrency(600) },
        { faturamento: formatCurrency(789.01), lucroLiquido: formatCurrency(300) },
      ),
      makeSnapshot(
        { faturamento: formatFinanceWidgetAmount(0), lucroLiquido: null },
        { faturamento: null, lucroLiquido: formatFinanceWidgetAmount(0) },
      ),
    ];

    for (const snapshot of snapshots) {
      const timeline = createFinanceWidgetTimeline(snapshot, new Date(2026, 9, 15, 10, 30));
      expect(timeline).toHaveLength(2);
      expect(timeline.every((entry) => isPropertyListValue(entry.props))).toBe(true);
    }
  });
});
