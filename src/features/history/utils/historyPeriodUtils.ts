import type { HistoryDelivery } from '../data/historyMocks';
import { HISTORY_MONTH_NAMES } from './historyDateUtils';

const HISTORY_SHORT_MONTH_NAMES = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

export type HistoryDateRange = {
  startDate: string;
  endDate: string;
};

export type WholesaleHistoryWeekRange = HistoryDateRange & {
  label: string;
  weekYear: number;
};

export type HistoryDeliveryDayGroup = {
  date: string;
  deliveries: readonly HistoryDelivery[];
};

export type HistoryWeekItem = {
  label: string;
  value: string;
};

export type HistoryWeekGroup = {
  label: string;
  items: readonly HistoryWeekItem[];
};

const HISTORY_WEEKDAY_NAMES = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'] as const;

function parseHistoryDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatHistoryDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getHistoryWeekRange(value: string): HistoryDateRange {
  const date = parseHistoryDate(value);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDay = Math.floor((date.getDate() - 1) / 7) * 7 + 1;
  const start = `${year}-${String(month).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;

  return {
    endDate: `${year}-${String(month).padStart(2, '0')}-${String(
      Math.min(startDay + 6, daysInMonth),
    ).padStart(2, '0')}`,
    startDate: start,
  };
}

export function getWholesaleHistoryWeekRange(value: string): WholesaleHistoryWeekRange {
  const date = parseHistoryDate(value);
  const daysSinceMonday = (date.getDay() + 6) % 7;
  const start = new Date(date);
  start.setDate(start.getDate() - daysSinceMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const thursday = new Date(start);
  thursday.setDate(thursday.getDate() + 3);
  const range = {
    endDate: formatHistoryDate(end),
    startDate: formatHistoryDate(start),
  };

  return {
    ...range,
    label: formatHistoryWeekLabel(range),
    weekYear: thursday.getFullYear(),
  };
}

export function getHistoryMonthRange(value: string): HistoryDateRange {
  const date = parseHistoryDate(value);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = formatHistoryDate(new Date(year, month, 0, 12, 0, 0, 0));

  return { endDate, startDate };
}

export function formatHistoryWeekLabel(range: HistoryDateRange): string {
  const start = parseHistoryDate(range.startDate);
  const end = parseHistoryDate(range.endDate);
  const startMonth = HISTORY_SHORT_MONTH_NAMES[start.getMonth()];
  const endMonth = HISTORY_SHORT_MONTH_NAMES[end.getMonth()];

  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${endMonth}`;
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} ${startMonth}–${end.getDate()} ${endMonth}`;
  }

  return `${start.getDate()} ${startMonth} ${start.getFullYear()}–${end.getDate()} ${endMonth} ${end.getFullYear()}`;
}

export function formatHistoryDayHeading(value: string): string {
  const date = parseHistoryDate(value);
  return `${HISTORY_WEEKDAY_NAMES[date.getDay()]} ${date.getDate()}`;
}

export function createHistoryWeekItems(year: number): readonly HistoryWeekItem[] {
  return HISTORY_MONTH_NAMES.flatMap((_, monthIndex) => {
    const month = monthIndex + 1;
    const monthRange = getHistoryMonthRange(`${year}-${String(month).padStart(2, '0')}-01`);
    const daysInMonth = Number(monthRange.endDate.slice(-2));

    return Array.from({ length: Math.ceil(daysInMonth / 7) }, (_, index) => {
      const range = getHistoryWeekRange(
        `${year}-${String(month).padStart(2, '0')}-${String(index * 7 + 1).padStart(2, '0')}`,
      );
      return { label: formatHistoryWeekLabel(range), value: range.startDate };
    });
  });
}

export function createHistoryWeekGroups(year: number): readonly HistoryWeekGroup[] {
  return HISTORY_MONTH_NAMES.map((label, monthIndex) => {
    const month = monthIndex + 1;
    const monthRange = getHistoryMonthRange(`${year}-${String(month).padStart(2, '0')}-01`);
    const daysInMonth = Number(monthRange.endDate.slice(-2));
    const items = Array.from({ length: Math.ceil(daysInMonth / 7) }, (_, index) => {
      const range = getHistoryWeekRange(
        `${year}-${String(month).padStart(2, '0')}-${String(index * 7 + 1).padStart(2, '0')}`,
      );
      return { label: formatHistoryWeekLabel(range), value: range.startDate };
    });

    return { items, label };
  });
}

export function createWholesaleHistoryWeekGroups(year: number): readonly HistoryWeekGroup[] {
  const januaryFourth = parseHistoryDate(`${year}-01-04`);
  const firstMonday = new Date(januaryFourth);
  firstMonday.setDate(januaryFourth.getDate() - ((januaryFourth.getDay() + 6) % 7));
  const groups = new Map<number, HistoryWeekItem[]>();

  for (let start = firstMonday; ; start.setDate(start.getDate() + 7)) {
    const startDate = formatHistoryDate(start);
    const range = getWholesaleHistoryWeekRange(startDate);
    if (range.weekYear !== year) break;

    const thursday = new Date(start);
    thursday.setDate(thursday.getDate() + 3);
    const month = thursday.getMonth();
    const items = groups.get(month) ?? [];
    items.push({ label: range.label, value: range.startDate });
    groups.set(month, items);
  }

  return [...groups.entries()].map(([month, items]) => ({
    items,
    label: HISTORY_MONTH_NAMES[month],
  }));
}

export function groupHistoryDeliveriesByDate(
  deliveries: readonly HistoryDelivery[],
  range: HistoryDateRange,
): readonly HistoryDeliveryDayGroup[] {
  const grouped = new Map<string, HistoryDelivery[]>();

  deliveries
    .filter((delivery) => delivery.data >= range.startDate && delivery.data <= range.endDate)
    .forEach((delivery) => {
      const dayDeliveries = grouped.get(delivery.data) ?? [];
      dayDeliveries.push(delivery);
      grouped.set(delivery.data, dayDeliveries);
    });

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, dayDeliveries]) => ({
      date,
      deliveries: [...dayDeliveries].sort(
        (left, right) =>
          left.cliente.localeCompare(right.cliente, 'pt-BR') || left.id.localeCompare(right.id),
      ),
    }));
}
