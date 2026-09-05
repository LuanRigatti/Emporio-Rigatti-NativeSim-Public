import { Stack } from 'expo-router';

import {
  createNativeDayItems,
  createNativeMonthItems,
  createNativeYearItems,
  formatNativeToolbarDate,
  updateNativeDate,
} from './nativeDateToolbarUtils';

type NativeDateToolbarProps = {
  mode?: 'day' | 'month' | 'week';
  onDateChange: (date: string) => void;
  onWeekChange?: (weekStart: string) => void;
  placement?: 'left' | 'right';
  selectedDate: string;
  weekGroups?: readonly NativeDateToolbarWeekGroup[];
};

type NativeDateToolbarWeekGroup = {
  label: string;
  items: readonly { label: string; value: string }[];
};

export function NativeDateToolbar({
  mode = 'day',
  onDateChange,
  onWeekChange,
  placement = 'right',
  selectedDate,
  weekGroups = [],
}: NativeDateToolbarProps) {
  const date = parseIsoDate(selectedDate);
  const [year, month, day] = selectedDate.split('-').map(Number);
  const monthItems = createNativeMonthItems();
  const yearItems = createNativeYearItems();
  const dayItems = createNativeDayItems(year, month);
  const toolbarTitle =
    mode === 'day' ? 'Selecionar data' : mode === 'week' ? 'Selecionar semana' : 'Selecionar mês';
  const selectedWeekStart = formatIsoDate(getWeekStart(date));
  const standardMenus = [
    <Stack.Toolbar.Menu icon="calendar" key="month" title="Mês">
      {monthItems.map((item) => (
        <Stack.Toolbar.MenuAction
          isOn={item.value === month}
          key={String(item.value)}
          onPress={() => onDateChange(updateNativeIsoDate(selectedDate, { month: item.value }))}
        >
          {item.label}
        </Stack.Toolbar.MenuAction>
      ))}
    </Stack.Toolbar.Menu>,
    <Stack.Toolbar.Menu icon="calendar.badge.clock" key="year" title="Ano">
      {yearItems.map((item) => (
        <Stack.Toolbar.MenuAction
          isOn={item.value === year}
          key={String(item.value)}
          onPress={() => onDateChange(updateNativeIsoDate(selectedDate, { year: item.value }))}
        >
          {item.label}
        </Stack.Toolbar.MenuAction>
      ))}
    </Stack.Toolbar.Menu>,
    ...(mode === 'day'
      ? [
          <Stack.Toolbar.Menu icon="calendar.day.timeline.left" key="day" title="Dia">
            {dayItems.map((value) => (
              <Stack.Toolbar.MenuAction
                isOn={value === day}
                key={String(value)}
                onPress={() => onDateChange(updateNativeIsoDate(selectedDate, { day: value }))}
              >
                {String(value)}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>,
        ]
      : []),
  ];

  return (
    <Stack.Toolbar placement={placement}>
      <Stack.Toolbar.Menu
        accessibilityLabel={toolbarTitle}
        separateBackground={false}
        title={toolbarTitle}
      >
        <Stack.Toolbar.Label>{formatToolbarLabel(date, mode)}</Stack.Toolbar.Label>
        {mode === 'week'
          ? weekGroups.map((group) => (
              <Stack.Toolbar.Menu icon="calendar" key={group.label} title={group.label}>
                {group.items.map((item) => (
                  <Stack.Toolbar.MenuAction
                    isOn={item.value === selectedWeekStart}
                    key={item.value}
                    onPress={() => onWeekChange?.(item.value)}
                  >
                    {item.label}
                  </Stack.Toolbar.MenuAction>
                ))}
              </Stack.Toolbar.Menu>
            ))
          : standardMenus}
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function updateNativeIsoDate(
  value: string,
  updates: Partial<{ day: number; month: number; year: number }>,
): string {
  return formatIsoDate(updateNativeDate(parseIsoDate(value), updates));
}

function formatToolbarMonth(value: Date): string {
  const month = [
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
  ][value.getMonth()];
  return `${month} ${value.getFullYear()}`;
}

function formatToolbarWeek(value: Date): string {
  const start = getWeekStart(value);
  const end = new Date(start);
  end.setDate(
    Math.min(end.getDate() + 6, new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()),
  );
  const month = [
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
  ];

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}–${end.getDate()} ${month[end.getMonth()]}`;
  }

  return `${start.getDate()} ${month[start.getMonth()]}–${end.getDate()} ${month[end.getMonth()]}`;
}

function formatToolbarLabel(value: Date, mode: NativeDateToolbarProps['mode']): string {
  if (mode === 'week') return formatToolbarWeek(value);
  if (mode === 'month') return formatToolbarMonth(value);
  return formatNativeToolbarDate(value);
}

function getWeekStart(value: Date): Date {
  const start = new Date(value);
  start.setDate(Math.floor((start.getDate() - 1) / 7) * 7 + 1);
  return start;
}

function formatIsoDate(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
