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
      <Text style={[theme.typography.headline, styles.title, { color: theme.colors.textPrimary }]}>
        Histórico
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
        accessibilityLabel="Filtrar histórico"
        color={theme.colors.textPrimary}
        containerSize={theme.sizes.touchTargetMinimum}
        fallbackIcon="filter-outline"
        interactiveGlass
        onPress={onFilterPress}
        size={theme.sizes.iconMedium}
        style={styles.filterSurface}
        systemImage="line.3.horizontal.decrease.circle"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    minHeight: 94,
    overflow: 'visible',
    position: 'relative',
    width: '100%',
  },
  title: { position: 'absolute', textAlign: 'center', top: 8, width: '100%' },
  copy: { alignItems: 'flex-start', left: 0, position: 'absolute', top: 56 },
  filterSurface: { overflow: 'visible', position: 'absolute', right: 0, top: 0, zIndex: 2 },
});
