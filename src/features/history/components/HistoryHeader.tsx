import { StyleSheet, Text, Pressable, View } from 'react-native';

import { GlassSurface } from '@/components/premium';
import { useAppTheme } from '@/theme';

import HistorySymbolIcon from './HistorySymbolIcon';
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
      <GlassSurface
        interactive
        style={[
          styles.filterSurface,
          {
            borderRadius: theme.radius.pill,
            height: theme.sizes.touchTargetMinimum,
            width: theme.sizes.touchTargetMinimum,
          },
        ]}
      >
        <Pressable
          accessibilityHint="Simula a abertura dos filtros"
          accessibilityLabel="Filtrar histórico"
          accessibilityRole="button"
          onPress={onFilterPress}
          style={({ pressed }) => [
            styles.filterButton,
            { opacity: pressed ? theme.opacities.pressed : 1 },
          ]}
        >
          <HistorySymbolIcon
            color={theme.colors.textPrimary}
            fallbackIcon="filter-outline"
            size={theme.sizes.iconMedium}
            systemName="line.3.horizontal.decrease.circle"
          />
        </Pressable>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', minHeight: 78, position: 'relative', width: '100%' },
  title: { position: 'absolute', textAlign: 'center', top: 0, width: '100%' },
  copy: { alignItems: 'flex-start', left: 0, position: 'absolute', top: 40 },
  filterSurface: { overflow: 'hidden', position: 'absolute', right: 0, top: 0 },
  filterButton: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
