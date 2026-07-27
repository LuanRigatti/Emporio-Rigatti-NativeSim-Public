import {
  createHistoryDate,
  generateHistoryCalendarDays,
  getAvailableHistoryYears,
  getDaysInMonth,
} from '@/features/history/utils/historyDateUtils';

describe('history date utilities', () => {
  it('generates the correct number of days for common and leap months', () => {
    expect(getDaysInMonth(2024, 1)).toBe(31);
    expect(getDaysInMonth(2024, 2)).toBe(29);
    expect(getDaysInMonth(2025, 2)).toBe(28);
    expect(getDaysInMonth(2025, 4)).toBe(30);
    expect(getDaysInMonth(2026, 7)).toBe(31);
  });

  it('generates safe local dates from the first to the last day', () => {
    const days = generateHistoryCalendarDays(2024, 2);

    expect(days[0]?.date).toBe('2024-02-01');
    expect(days[0]?.dayNumber).toBe('01');
    expect(days.at(-1)?.date).toBe('2024-02-29');
  });

  it('keeps month and year transitions explicit', () => {
    expect(createHistoryDate(2024, 12, 31)).toBe('2024-12-31');
    expect(createHistoryDate(2025, 1, 1)).toBe('2025-01-01');
  });

  it('generates available years dynamically from the configured start', () => {
    expect(getAvailableHistoryYears(2024, 2026)).toEqual([2024, 2025, 2026]);
  });
});
