import {
  createFinanceWidgetTimeline,
  formatFinanceWidgetAmount,
  getFinanceWidgetMonthKey,
  getFinanceWidgetMonthLabel,
  unavailableFinanceWidgetProps,
} from '@/features/finance/widgets/ResumoFinanceiroSnapshot';
import { formatCurrency } from '@/utils/data';

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

  it('schedules an unavailable snapshot at the next month boundary', () => {
    const now = new Date(2026, 9, 15, 10, 30);
    const current = unavailableFinanceWidgetProps('2026-10');
    const timeline = createFinanceWidgetTimeline(current, now);

    expect(timeline).toHaveLength(2);
    expect(timeline[0]).toEqual({ date: now, props: current });
    expect(timeline[1]?.date).toEqual(new Date(2026, 10, 1));
    expect(timeline[1]?.props).toEqual(unavailableFinanceWidgetProps('2026-11'));
  });
});
