import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

import { AttachmentIcon } from '../AttachmentIcon';
import { BOTTOM_BAR } from '../constants';

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

const WEEKDAY_NAMES = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const;

function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function LocalCalendar() {
  const { theme } = useAppTheme();
  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(() => dateKey(today));

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const monthDays = daysInMonth(year, month);
  const leadingEmptyDays = new Date(year, month, 1).getDay();
  const cellCount = Math.ceil((leadingEmptyDays + monthDays) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, index) => {
    const day = index - leadingEmptyDays + 1;
    return day >= 1 && day <= monthDays ? day : null;
  });
  const rows = Array.from({ length: cellCount / 7 }, (_, rowIndex) =>
    cells.slice(rowIndex * 7, rowIndex * 7 + 7),
  );
  const todayKey = dateKey(today);
  const title = `${MONTH_NAMES[month]} ${year}`;

  const changeMonth = (delta: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  return (
    <View
      style={[
        styles.root,
        {
          paddingBottom: BOTTOM_BAR.inset + BOTTOM_BAR.controlSize + theme.spacing.sm,
        },
      ]}
    >
      <View style={styles.monthHeader}>
        <Pressable
          accessibilityLabel="Mês anterior"
          accessibilityRole="button"
          hitSlop={4}
          onPress={() => changeMonth(-1)}
          style={styles.navigationButton}
        >
          <AttachmentIcon name="chevron-left" size={20} color={theme.colors.textPrimary} />
        </Pressable>
        <Text
          style={[
            theme.typography.headline,
            styles.monthTitle,
            { color: theme.colors.textPrimary },
          ]}
        >
          {title}
        </Text>
        <Pressable
          accessibilityLabel="Próximo mês"
          accessibilityRole="button"
          hitSlop={4}
          onPress={() => changeMonth(1)}
          style={styles.navigationButton}
        >
          <AttachmentIcon name="chevron-right" size={20} color={theme.colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_NAMES.map((weekday, index) => (
          <Text
            key={`${weekday}-${index}`}
            style={[
              theme.typography.caption,
              styles.weekday,
              { color: theme.colors.textSecondary },
            ]}
          >
            {weekday}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {rows.map((row, rowIndex) => (
          <View key={`week-${rowIndex}`} style={styles.weekRow}>
            {row.map((day, cellIndex) => {
              if (day === null) {
                return <View key={`empty-${rowIndex}-${cellIndex}`} style={styles.cell} />;
              }

              const dayDate = new Date(year, month, day);
              const currentKey = dateKey(dayDate);
              const isSelected = currentKey === selectedDate;
              const isToday = currentKey === todayKey;

              return (
                <View key={currentKey} style={styles.cell}>
                  <Pressable
                    accessibilityLabel={`${day} de ${MONTH_NAMES[month]} de ${year}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setSelectedDate(currentKey)}
                    style={styles.dayButton}
                  >
                    <View
                      style={[
                        styles.dayCircle,
                        isSelected
                          ? { backgroundColor: theme.colors.selectionSurface }
                          : isToday
                            ? { borderColor: theme.colors.primary, borderWidth: 1 }
                            : undefined,
                      ]}
                    >
                      <Text
                        style={[
                          theme.typography.subheadline,
                          styles.dayText,
                          {
                            color: isSelected
                              ? theme.colors.selectionContent
                              : theme.colors.textPrimary,
                          },
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    width: '100%',
  },
  monthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  navigationButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  monthTitle: {
    flex: 1,
    textAlign: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
  },
  grid: {
    flex: 1,
    justifyContent: 'space-between',
    marginTop: 2,
  },
  weekRow: {
    flexDirection: 'row',
    height: 40,
  },
  cell: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  dayButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  dayCircle: {
    alignItems: 'center',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  dayText: {
    textAlign: 'center',
  },
});
