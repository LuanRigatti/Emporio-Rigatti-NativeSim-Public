import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassIconButton } from '@/components/native';
import { useAppTheme } from '@/theme';

import { PeriodSelector } from './PeriodSelector';

export type HistoryHeaderProps = {
  onFilterPress: () => void;
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
};

export function HistoryHeader({
  onFilterPress,
  onMonthChange,
  onYearChange,
  selectedMonth,
  selectedYear,
}: HistoryHeaderProps) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.container}>
      <Text style={[theme.typography.title3, styles.title, { color: theme.colors.textPrimary }]}>
        HistÃ³rico
      </Text>
      <View style={styles.copy}>
        <PeriodSelector
          month={selectedMonth}
          onMonthChange={onMonthChange}
          onYearChange={onYearChange}
          year={selectedYear}
        />
      </View>
      <NativeGlassIconButton
        accessibilityLabel="Filtrar histÃ³rico"
        color={theme.colors.textPrimary}
        containerSize={theme.sizes.touchTargetMinimum}
        fallbackIcon="filter-outline"
        onPress={onFilterPress}
        size={theme.sizes.iconMedium}
        style={styles.filterSurface}
        systemImage="line.3.horizontal.decrease.circle"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', minHeight: 78, position: 'relative', width: '100%' },
  title: { position: 'absolute', textAlign: 'center', top: 0, width: '100%' },
  copy: { alignItems: 'flex-start', left: 0, position: 'absolute', top: 40 },
  filterSurface: { position: 'absolute', right: 0, top: 0 },
});
