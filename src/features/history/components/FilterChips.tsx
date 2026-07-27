import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AnimatedPressable, GlassSurface } from '@/components/premium';
import { useAppTheme } from '@/theme';

export const historyFilterOptions = ['Todos', 'Concluídas', 'Pendentes', 'Hoje'] as const;

export type HistoryFilter = (typeof historyFilterOptions)[number];

export type FilterChipsProps = {
  selectedFilter: HistoryFilter;
  onSelectFilter: (filter: HistoryFilter) => void;
};

type HistoryFilterChipProps = {
  filter: HistoryFilter;
  selected: boolean;
  onSelectFilter: (filter: HistoryFilter) => void;
};

function HistoryFilterChip({ filter, onSelectFilter, selected }: HistoryFilterChipProps) {
  const { reduceMotionEnabled, resolvedMode, theme } = useAppTheme();
  const selectedChipBackground =
    resolvedMode === 'dark' ? theme.colors.background : theme.colors.contrastSurface;
  const selectedChipText =
    resolvedMode === 'dark' ? theme.colors.textPrimary : theme.colors.textInverse;
  const selectionScale = useSharedValue(selected ? 1 : 0.98);

  useEffect(() => {
    selectionScale.value = withTiming(selected ? 1 : 0.98, {
      duration: reduceMotionEnabled
        ? theme.animations.duration.instant
        : theme.animations.duration.fast,
    });
  }, [
    reduceMotionEnabled,
    selected,
    selectionScale,
    theme.animations.duration.fast,
    theme.animations.duration.instant,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: selectionScale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <GlassSurface
        style={[
          styles.chipSurface,
          {
            backgroundColor: selected ? selectedChipBackground : theme.colors.glassSurface,
            borderColor: selected ? selectedChipBackground : theme.colors.glassBorder,
            borderRadius: theme.radius.pill,
          },
        ]}
      >
        <AnimatedPressable
          accessibilityLabel={`Filtro ${filter}`}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          onPress={() => onSelectFilter(filter)}
          style={({ pressed }) => [styles.chip, { opacity: pressed ? theme.opacities.pressed : 1 }]}
        >
          <Text
            style={[
              theme.typography.footnote,
              { color: selected ? selectedChipText : theme.colors.textSecondary },
            ]}
          >
            {filter}
          </Text>
        </AnimatedPressable>
      </GlassSurface>
    </Animated.View>
  );
}

export function FilterChips({ onSelectFilter, selectedFilter }: FilterChipsProps) {
  const { theme } = useAppTheme();

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { gap: theme.spacing.xs }]}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {historyFilterOptions.map((filter) => {
        const selected = filter === selectedFilter;
        return (
          <HistoryFilterChip
            filter={filter}
            key={filter}
            onSelectFilter={onSelectFilter}
            selected={selected}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 2 },
  chipSurface: { overflow: 'hidden' },
  chip: { minHeight: 30, justifyContent: 'center', paddingHorizontal: 10 },
});
