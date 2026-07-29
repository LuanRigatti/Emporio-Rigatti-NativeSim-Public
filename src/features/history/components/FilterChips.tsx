import { ScrollView, StyleSheet } from 'react-native';

import { NativeChip } from '@/components/native';
import { useAppTheme } from '@/theme';

export const historyFilterOptions = ['Todos', 'Concluídas', 'Pendentes', 'Hoje'] as const;

export type HistoryFilter = (typeof historyFilterOptions)[number];

export type FilterChipsProps = {
  selectedFilter: HistoryFilter;
  onSelectFilter: (filter: HistoryFilter) => void;
};

export function FilterChips({ onSelectFilter, selectedFilter }: FilterChipsProps) {
  const { theme } = useAppTheme();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { gap: theme.spacing.xs, paddingLeft: theme.spacing.xs },
      ]}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -theme.layout.screenHorizontalPadding }}
    >
      {historyFilterOptions.map((filter) => (
        <NativeChip
          key={filter}
          label={filter}
          onPress={() => onSelectFilter(filter)}
          selected={filter === selectedFilter}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 2 },
});
