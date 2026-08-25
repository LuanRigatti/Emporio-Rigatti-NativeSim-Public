import { Stack } from 'expo-router';

type NativeDateToolbarProps = {
  onDateChange: (date: string) => void;
  placement?: 'left' | 'right';
  selectedDate: string;
};

export function NativeDateToolbar({
  onDateChange,
  placement = 'right',
  selectedDate,
}: NativeDateToolbarProps) {
  const date = parseIsoDate(selectedDate);
  const [year, month, day] = selectedDate.split('-').map(Number);
  const monthItems = createMonthItems();
  const yearItems = createYearItems();
  const dayItems = Array.from({ length: daysInMonth(year, month) }, (_, index) => index + 1);

  return (
    <Stack.Toolbar placement={placement}>
      <Stack.Toolbar.Menu
        accessibilityLabel="Selecionar data"
        separateBackground={false}
        title="Selecionar data"
      >
        <Stack.Toolbar.Label>{formatToolbarDate(date)}</Stack.Toolbar.Label>
        <Stack.Toolbar.Menu icon="calendar" title="Mês">
          {monthItems.map((item) => (
            <Stack.Toolbar.MenuAction
              isOn={item.value === month}
              key={String(item.value)}
              onPress={() => onDateChange(updateIsoDate(selectedDate, { month: item.value }))}
            >
              {item.label}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Menu icon="calendar.badge.clock" title="Ano">
          {yearItems.map((item) => (
            <Stack.Toolbar.MenuAction
              isOn={item.value === year}
              key={String(item.value)}
              onPress={() => onDateChange(updateIsoDate(selectedDate, { year: item.value }))}
            >
              {item.label}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Menu icon="calendar.day.timeline.left" title="Dia">
          {dayItems.map((value) => (
            <Stack.Toolbar.MenuAction
              isOn={value === day}
              key={String(value)}
              onPress={() => onDateChange(updateIsoDate(selectedDate, { day: value }))}
            >
              {String(value)}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function updateIsoDate(
  value: string,
  updates: Partial<{ day: number; month: number; year: number }>,
): string {
  const [year, month, day] = value.split('-').map(Number);
  const nextYear = updates.year ?? year;
  const nextMonth = updates.month ?? month;
  const nextDay = Math.min(updates.day ?? day, daysInMonth(nextYear, nextMonth));
  return `${nextYear}-${pad(nextMonth)}-${pad(nextDay)}`;
}

function createMonthItems(): readonly ToolbarDateItem[] {
  return Array.from({ length: 12 }, (_, index) => ({
    label: monthLabel(index + 1),
    value: index + 1,
  }));
}

function createYearItems(): readonly ToolbarDateItem[] {
  return [2024, 2025, 2026].map((year) => ({ label: String(year), value: year }));
}

function monthLabel(month: number): string {
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(
    new Date(2026, month - 1, 1),
  );
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function formatToolbarDate(value: Date): string {
  const month = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][
    value.getMonth()
  ];
  return `${value.getDate()} ${month}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

type ToolbarDateItem = {
  label: string;
  value: number;
};
