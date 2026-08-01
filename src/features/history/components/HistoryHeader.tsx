import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassIconButton, NativeGlassMenu } from '@/components/native';
import type { NativeMenuAction } from '@/components/native';
import { useAppTheme } from '@/theme';

import type { HistoryFilter } from './FilterChips';
import { PeriodSelector } from './PeriodSelector';

export type HistoryHeaderProps = {
  onFilterPress: () => void;
  onFilterSelect: (filter: HistoryFilter) => void;
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
};

export function HistoryHeader({
  onFilterPress,
  onFilterSelect,
  onMonthChange,
  onYearChange,
  selectedMonth,
  selectedYear,
}: HistoryHeaderProps) {
  const { theme } = useAppTheme();
  const filterActions: readonly NativeMenuAction[] = [
    {
      id: 'completed',
      onPress: () => onFilterSelect('Concluídas'),
      systemImage: 'checkmark.circle',
      title: 'Concluídas',
    },
    {
      id: 'pending',
      onPress: () => onFilterSelect('Pendentes'),
      systemImage: 'clock',
      title: 'Pendentes',
    },
    {
      id: 'today',
      onPress: () => onFilterSelect('Hoje'),
      systemImage: 'calendar',
      title: 'Hoje',
    },
  ];

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
      <NativeGlassMenu
        accessibilityLabel="Filtros do histórico"
        actions={filterActions}
        color={theme.colors.textPrimary}
        containerSize={theme.sizes.touchTargetMinimum}
        fallbackIcon="filter-outline"
        size={theme.sizes.iconMedium}
        style={styles.filterSurface}
        systemImage="line.3.horizontal.decrease.circle"
        trigger={
          <NativeGlassIconButton
            accessibilityLabel="Filtros do histórico"
            color={theme.colors.textPrimary}
            containerSize={theme.sizes.touchTargetMinimum}
            fallbackIcon="filter-outline"
            interactiveGlass
            onPress={onFilterPress}
            size={theme.sizes.iconMedium}
            style={styles.filterSurface}
            systemImage="line.3.horizontal.decrease.circle"
          />
        }
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
    zIndex: 2,
  },
  title: { position: 'absolute', textAlign: 'center', top: 8, width: '100%' },
  copy: { alignItems: 'flex-start', left: 0, position: 'absolute', top: 56 },
  filterSurface: { overflow: 'visible', position: 'absolute', right: 0, top: 0, zIndex: 2 },
});
