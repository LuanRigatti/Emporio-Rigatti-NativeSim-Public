import { addDailyValue } from '@/services/costs/dailyDataAggregation';

describe('daily data incremental values', () => {
  it('adds a new value to the existing total', () => {
    expect(addDailyValue('20', '15')).toBe('35');
  });

  it('supports currency and decimal input formats', () => {
    expect(addDailyValue('R$ 20,00', '15,50')).toBe('35.5');
  });

  it('keeps the current value when the new entry is empty or zero', () => {
    expect(addDailyValue('20', '')).toBe('20');
    expect(addDailyValue('20', '0')).toBe('20');
  });
});
