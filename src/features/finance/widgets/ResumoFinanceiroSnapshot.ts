import type { WidgetTimelineEntry } from 'expo-widgets';

import { formatCurrency } from '@/utils/data';

export type FinanceWidgetMode = 'wholesale' | 'retail';

export type FinanceWidgetDomainSnapshot = {
  faturamento: string | null;
  lucroLiquido: string | null;
};

export type ResumoFinanceiroWidgetProps = {
  monthKey: string;
  monthLabel: string;
  wholesale: FinanceWidgetDomainSnapshot;
  retail: FinanceWidgetDomainSnapshot;
};

export function getFinanceWidgetMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getNextFinanceWidgetMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const nextMonth = new Date(year, month, 1);
  return getFinanceWidgetMonthKey(nextMonth);
}

export function getFinanceWidgetMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const parts = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
  }).formatToParts(new Date(year, month - 1, 1, 12));
  const monthName = parts.find((part) => part.type === 'month')?.value ?? '';
  return `${monthName} ${year}`.toLocaleUpperCase('pt-BR');
}

export function formatFinanceWidgetAmount(value: number | null): string | null {
  return typeof value === 'number' && Number.isFinite(value) ? formatCurrency(value) : null;
}

export function emptyFinanceWidgetDomain(): FinanceWidgetDomainSnapshot {
  return { faturamento: null, lucroLiquido: null };
}

export function unavailableFinanceWidgetProps(monthKey: string): ResumoFinanceiroWidgetProps {
  return {
    monthKey,
    monthLabel: getFinanceWidgetMonthLabel(monthKey),
    wholesale: emptyFinanceWidgetDomain(),
    retail: emptyFinanceWidgetDomain(),
  };
}

export function createFinanceWidgetTimeline(
  current: ResumoFinanceiroWidgetProps,
  now: Date,
): WidgetTimelineEntry<ResumoFinanceiroWidgetProps>[] {
  const [year, month] = current.monthKey.split('-').map(Number);
  const nextMonth = getNextFinanceWidgetMonth(current.monthKey);

  return [
    { date: now, props: current },
    {
      date: new Date(year, month, 1),
      props: unavailableFinanceWidgetProps(nextMonth),
    },
  ];
}
