import { Stack } from 'expo-router';
import type { ReactNode } from 'react';

import {
  HISTORY_MONTH_ITEMS,
  getHistoryYearItems,
} from '@/features/history/components/periodOptions';

export type FinancePeriodToolbarProps = {
  composition: 'combined' | 'split';
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  selectedMonth: number;
  selectedYear: number;
};

export function renderFinancePeriodToolbarItems({
  composition,
  onMonthChange,
  onYearChange,
  selectedMonth,
  selectedYear,
}: FinancePeriodToolbarProps): ReactNode[] {
  const periodLabel = `${monthShortLabel(selectedMonth)} ${selectedYear}`;

  if (composition === 'combined') {
    return [
      <Stack.Toolbar.Menu
        accessibilityLabel="Selecionar período"
        key="period"
        separateBackground={false}
      >
        <Stack.Toolbar.Label>{periodLabel}</Stack.Toolbar.Label>
        <Stack.Toolbar.Menu icon="calendar" title="Mês">
          {HISTORY_MONTH_ITEMS.map((item) => (
            <Stack.Toolbar.MenuAction
              isOn={item.value === selectedMonth}
              key={String(item.value)}
              onPress={() => onMonthChange(item.value)}
            >
              {item.label}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Menu icon="calendar.badge.clock" title="Ano">
          {getHistoryYearItems().map((item) => (
            <Stack.Toolbar.MenuAction
              isOn={item.value === selectedYear}
              key={String(item.value)}
              onPress={() => onYearChange(item.value)}
            >
              {item.label}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar.Menu>,
    ];
  }

  return [
    <Stack.Toolbar.Menu
      accessibilityLabel="Selecionar mês"
      key="month"
      separateBackground={false}
      title="Mês"
    >
      <Stack.Toolbar.Label>{monthShortLabel(selectedMonth)}</Stack.Toolbar.Label>
      {HISTORY_MONTH_ITEMS.map((item) => (
        <Stack.Toolbar.MenuAction
          isOn={item.value === selectedMonth}
          key={String(item.value)}
          onPress={() => onMonthChange(item.value)}
        >
          {item.label}
        </Stack.Toolbar.MenuAction>
      ))}
    </Stack.Toolbar.Menu>,
    <Stack.Toolbar.Menu
      accessibilityLabel="Selecionar ano"
      key="year"
      separateBackground={false}
      title="Ano"
    >
      <Stack.Toolbar.Label>{String(selectedYear)}</Stack.Toolbar.Label>
      {getHistoryYearItems().map((item) => (
        <Stack.Toolbar.MenuAction
          isOn={item.value === selectedYear}
          key={String(item.value)}
          onPress={() => onYearChange(item.value)}
        >
          {item.label}
        </Stack.Toolbar.MenuAction>
      ))}
    </Stack.Toolbar.Menu>,
  ];
}

export function FinancePeriodToolbar(props: FinancePeriodToolbarProps) {
  return <Stack.Toolbar placement="right">{renderFinancePeriodToolbarItems(props)}</Stack.Toolbar>;
}

function monthShortLabel(month: number): string {
  return (
    ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][
      month - 1
    ] ?? String(month)
  );
}
