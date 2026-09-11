import {
  createNativeDayItems,
  formatNativeToolbarDate,
  updateNativeDate,
} from '@/components/native/nativeDateToolbarUtils';

describe('native date toolbar utilities', () => {
  it('formats the compact Portuguese label used by the History toolbar', () => {
    expect(formatNativeToolbarDate(new Date(2026, 8, 5, 12))).toBe('5 Set');
  });

  it('updates the selected date while preserving valid calendar days', () => {
    const selectedDate = new Date(2026, 0, 31, 12);
    const updatedDate = updateNativeDate(selectedDate, { month: 2 });

    expect(updatedDate.getFullYear()).toBe(2026);
    expect(updatedDate.getMonth()).toBe(1);
    expect(updatedDate.getDate()).toBe(28);
    expect(createNativeDayItems(2026, 2)).toHaveLength(28);
  });
});
