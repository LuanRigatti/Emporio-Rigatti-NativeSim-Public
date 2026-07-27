import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme';

import { MonthPicker } from './MonthPicker';
import { YearPicker } from './YearPicker';

export type PeriodSelectorProps = {
  month: number;
  year: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
};

export function PeriodSelector({ month, onMonthChange, onYearChange, year }: PeriodSelectorProps) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.container, { gap: theme.spacing.xs }]}>
      <MonthPicker month={month} onChange={onMonthChange} />
      <YearPicker onChange={onYearChange} year={year} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flexDirection: 'row' },
});
