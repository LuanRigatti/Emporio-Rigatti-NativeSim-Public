import type { HistoryDelivery } from '@/features/history/data/historyMocks';
import {
  createHistoryWeekGroups,
  createHistoryWeekItems,
  createWholesaleHistoryWeekGroups,
  formatHistoryDayHeading,
  formatHistoryWeekLabel,
  getHistoryMonthRange,
  getHistoryWeekRange,
  getWholesaleHistoryWeekRange,
  groupHistoryDeliveriesByDate,
} from '@/features/history/utils/historyPeriodUtils';

const delivery = (id: string, data: string, cliente: string): HistoryDelivery => ({
  bairro: '',
  cliente,
  data,
  formaPagamento: '',
  id,
  observacoes: '',
  quantidadeBaldes: 1,
  status: 'concluída',
  valor: 'R$ 0,00',
});

describe('history period utilities', () => {
  it('keeps weekly intervals contained within the selected month', () => {
    const range = getHistoryWeekRange('2026-09-02');

    expect(range).toEqual({ startDate: '2026-09-01', endDate: '2026-09-07' });
    expect(formatHistoryWeekLabel(range)).toBe('1–7 Set');
  });

  it('closes the final interval at the last day for 30, 31 and February months', () => {
    expect(getHistoryWeekRange('2026-09-30')).toEqual({
      startDate: '2026-09-29',
      endDate: '2026-09-30',
    });
    expect(getHistoryWeekRange('2026-10-31')).toEqual({
      startDate: '2026-10-29',
      endDate: '2026-10-31',
    });
    expect(getHistoryWeekRange('2024-02-29')).toEqual({
      startDate: '2024-02-29',
      endDate: '2024-02-29',
    });
  });

  it('keeps every History week boundary month-local', () => {
    const cases = [
      ['2026-09-01', '2026-09-01', '2026-09-07'],
      ['2026-09-07', '2026-09-01', '2026-09-07'],
      ['2026-09-08', '2026-09-08', '2026-09-14'],
      ['2026-09-14', '2026-09-08', '2026-09-14'],
      ['2026-09-15', '2026-09-15', '2026-09-21'],
      ['2026-09-21', '2026-09-15', '2026-09-21'],
      ['2026-09-22', '2026-09-22', '2026-09-28'],
      ['2026-09-28', '2026-09-22', '2026-09-28'],
      ['2026-09-29', '2026-09-29', '2026-09-30'],
      ['2026-09-30', '2026-09-29', '2026-09-30'],
      ['2026-10-31', '2026-10-29', '2026-10-31'],
      ['2026-12-31', '2026-12-29', '2026-12-31'],
      ['2027-01-01', '2027-01-01', '2027-01-07'],
      ['2024-02-29', '2024-02-29', '2024-02-29'],
    ] as const;

    cases.forEach(([value, startDate, endDate]) => {
      expect(getHistoryWeekRange(value)).toEqual({ endDate, startDate });
    });
  });

  it('creates chronological month-contained week options for the selected year', () => {
    const items = createHistoryWeekItems(2026);

    expect(items[0]).toEqual({ label: '1–7 Jan', value: '2026-01-01' });
    expect(items.some((item) => item.value === '2026-08-30')).toBe(false);
    expect(items.some((item) => item.value === '2026-09-29')).toBe(true);
  });

  it('groups week options by the selected calendar month', () => {
    const september = createHistoryWeekGroups(2026).find((group) => group.label === 'Setembro');

    expect(september?.items.map((item) => item.label)).toEqual([
      '1–7 Set',
      '8–14 Set',
      '15–21 Set',
      '22–28 Set',
      '29–30 Set',
    ]);
  });

  it('recalculates independent internal intervals when changing months', () => {
    const october = createHistoryWeekGroups(2026).find((group) => group.label === 'Outubro');

    expect(october?.items.map((item) => item.label)).toEqual([
      '1–7 Out',
      '8–14 Out',
      '15–21 Out',
      '22–28 Out',
      '29–31 Out',
    ]);
  });

  it('creates the complete calendar range for a selected month', () => {
    expect(getHistoryMonthRange('2024-02-17')).toEqual({
      startDate: '2024-02-01',
      endDate: '2024-02-29',
    });
  });

  it('groups only real delivery dates in chronological order', () => {
    const groups = groupHistoryDeliveriesByDate(
      [
        delivery('2', '2026-09-04', 'Elias'),
        delivery('1', '2026-09-02', 'André'),
        delivery('3', '2026-09-04', 'Bruno'),
        delivery('4', '2026-09-09', 'Fora do período'),
      ],
      { endDate: '2026-09-07', startDate: '2026-09-01' },
    );

    expect(groups.map((group) => group.date)).toEqual(['2026-09-02', '2026-09-04']);
    expect(groups[1]?.deliveries.map((item) => item.cliente)).toEqual(['Bruno', 'Elias']);
  });

  it('uses Monday through Sunday for Wholesale calendar weeks and labels the same range', () => {
    const range = getWholesaleHistoryWeekRange('2026-09-22');

    expect(range).toMatchObject({
      endDate: '2026-09-27',
      label: '21–27 Set',
      startDate: '2026-09-21',
    });
  });

  it('includes Monday and Sunday but excludes the following Monday from the selected week', () => {
    const groups = groupHistoryDeliveriesByDate(
      [
        delivery('monday', '2026-09-21', 'Segunda'),
        delivery('sunday', '2026-09-27', 'Domingo'),
        delivery('next-monday', '2026-09-28', 'Segunda seguinte'),
      ],
      getWholesaleHistoryWeekRange('2026-09-22'),
    );

    expect(groups.map((group) => group.date)).toEqual(['2026-09-21', '2026-09-27']);
  });

  it('keeps calendar weeks continuous across month and year boundaries', () => {
    expect(getWholesaleHistoryWeekRange('2026-05-01')).toMatchObject({
      endDate: '2026-05-03',
      startDate: '2026-04-27',
    });
    expect(getWholesaleHistoryWeekRange('2027-01-01')).toMatchObject({
      endDate: '2027-01-03',
      startDate: '2026-12-28',
      weekYear: 2026,
    });
    expect(getWholesaleHistoryWeekRange('2027-01-04')).toMatchObject({
      endDate: '2027-01-10',
      startDate: '2027-01-04',
      weekYear: 2027,
    });
  });

  it('creates one canonical option per Monday without gaps and leaves shared ranges unchanged', () => {
    const groups = createWholesaleHistoryWeekGroups(2026);
    const items = groups.flatMap((group) => group.items);
    const startDates = items.map((item) => item.value);

    expect(new Set(startDates).size).toBe(startDates.length);
    expect(items.find((item) => item.value === '2026-09-21')).toEqual({
      label: '21–27 Set',
      value: '2026-09-21',
    });
    expect(
      startDates.every((value, index) => {
        if (index === 0) return true;
        const previousMonday = new Date(`${startDates[index - 1]}T12:00:00`);
        previousMonday.setDate(previousMonday.getDate() + 7);
        return (
          value ===
          [
            previousMonday.getFullYear(),
            String(previousMonday.getMonth() + 1).padStart(2, '0'),
            String(previousMonday.getDate()).padStart(2, '0'),
          ].join('-')
        );
      }),
    ).toBe(true);
    expect(getHistoryWeekRange('2026-09-22')).toEqual({
      endDate: '2026-09-28',
      startDate: '2026-09-22',
    });
  });

  it('formats the weekday and day used by period section headers', () => {
    expect(formatHistoryDayHeading('2026-09-02')).toBe('QUA 2');
  });
});
