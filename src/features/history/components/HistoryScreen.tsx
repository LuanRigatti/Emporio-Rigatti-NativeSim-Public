import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Stack, useFocusEffect } from 'expo-router';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeRetailFinanceCategorySelector,
  renderNativeDateToolbarItems,
} from '@/components/native';
import { GlassCard, ProgressiveCollapsibleScreen } from '@/components/premium';
import { useAppSafeAreaInsets } from '@/providers';
import { useAppTheme } from '@/theme';
import { triggerSelectionHaptic } from '@/utils/haptics';
import { toHistoryDelivery } from '@/services/data';
import { useDeliveries } from '@/hooks/useDeliveries';
import { todayIso } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import { DeliveryCard } from './DeliveryCard';
import { EmptyState } from './EmptyState';
import { HistoryCompactDeliveryCard } from './HistoryCompactDeliveryCard';
import type { HistoryFilter } from './FilterChips';
import {
  createWholesaleHistoryWeekGroups,
  formatHistoryDayHeading,
  getHistoryMonthRange,
  getWholesaleHistoryWeekRange,
  groupHistoryDeliveriesByDate,
} from '../utils/historyPeriodUtils';

type HistoryViewMode = 'day' | 'week' | 'month';

const HISTORY_VIEW_MODE_ITEMS: readonly { key: HistoryViewMode; label: string }[] = [
  { key: 'day', label: 'Dia' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
];

function filterDayDeliveries<T extends { status: string }>(
  deliveries: readonly T[],
  filter: HistoryFilter,
): readonly T[] {
  if (filter === 'Pendentes') {
    return deliveries.filter((delivery) => delivery.status === 'pendente');
  }

  if (filter === 'Todos' || filter === 'Hoje') {
    return deliveries;
  }

  return deliveries.filter((delivery) => delivery.status !== 'pendente');
}

export function HistoryScreen() {
  const insets = useAppSafeAreaInsets();
  const { reduceMotionEnabled, theme } = useAppTheme();
  const { enabled: testModeEnabled, quantity: maskQuantity } = useTestModePresentation();
  const [selectedDate, setSelectedDate] = useState(() => todayIso());
  const [viewMode, setViewMode] = useState<HistoryViewMode>('day');
  const {
    reload: refresh,
    remove: removeDelivery,
    deliveries,
    setDelivered,
    toggleDelivered: toggleDelivery,
  } = useDeliveries({ mode: 'all' }, { scope: 'historical' });
  const allDeliveries = useMemo(() => deliveries.map(toHistoryDelivery), [deliveries]);
  const selectedWeek = useMemo(() => getWholesaleHistoryWeekRange(selectedDate), [selectedDate]);
  const weekGroups = useMemo(
    () => createWholesaleHistoryWeekGroups(selectedWeek.weekYear),
    [selectedWeek.weekYear],
  );
  const [selectedFilter, setSelectedFilter] = useState<HistoryFilter>('Todos');
  const selectedRange = useMemo(() => {
    if (viewMode === 'day') return { endDate: selectedDate, startDate: selectedDate };
    if (viewMode === 'week') return selectedWeek;
    return getHistoryMonthRange(selectedDate);
  }, [selectedDate, selectedWeek, viewMode]);
  const todayDate = todayIso();
  const selectedPeriodDeliveries = useMemo(() => {
    const periodDeliveries = allDeliveries.filter(
      (delivery) =>
        delivery.data >= selectedRange.startDate && delivery.data <= selectedRange.endDate,
    );

    if (viewMode !== 'day' && selectedFilter === 'Hoje') {
      return periodDeliveries.filter((delivery) => delivery.data === todayDate);
    }

    return filterDayDeliveries(periodDeliveries, selectedFilter);
  }, [allDeliveries, selectedFilter, selectedRange, todayDate, viewMode]);
  const totalBuckets = selectedPeriodDeliveries.reduce(
    (total, delivery) => total + delivery.quantidadeBaldes,
    0,
  );
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
    setSelectedFilter('Todos');
  }, []);

  const handleToggleStatus = useCallback(
    (deliveryId: string) => {
      if (testModeEnabled) return;
      triggerSelectionHaptic();
      void toggleDelivery(deliveryId);
    },
    [testModeEnabled, toggleDelivery],
  );

  const handleMarkDelivered = useCallback(
    (deliveryId: string) => {
      if (testModeEnabled) return;
      triggerSelectionHaptic();
      void setDelivered(deliveryId, true);
    },
    [setDelivered, testModeEnabled],
  );

  const handleDeleteDelivery = useCallback(
    (deliveryId: string) => {
      if (testModeEnabled) return;
      void removeDelivery(deliveryId);
    },
    [removeDelivery, testModeEnabled],
  );

  const renderDayContent = useCallback(() => {
    const visibleDeliveries = selectedPeriodDeliveries;
    return (
      <>
        <Animated.View
          entering={FadeIn.duration(reduceMotionEnabled ? 0 : theme.animations.duration.standard)}
          style={[
            styles.list,
            {
              gap: theme.spacing.sm,
              marginTop: theme.spacing.xs,
              paddingBottom: theme.spacing.lg,
              ...(visibleDeliveries.length === 0 ? styles.emptyList : null),
            },
          ]}
        >
          {visibleDeliveries.length > 0 ? (
            visibleDeliveries.map((delivery) => (
              <Animated.View
                entering={FadeIn.duration(
                  reduceMotionEnabled ? 0 : theme.animations.duration.standard,
                )}
                key={delivery.id}
                layout={LinearTransition.duration(
                  reduceMotionEnabled ? 0 : theme.animations.duration.standard,
                )}
                style={styles.fullWidth}
              >
                <DeliveryCard
                  contained
                  delivery={delivery}
                  onDelete={() => handleDeleteDelivery(delivery.id)}
                  onMarkDelivered={() => handleMarkDelivered(delivery.id)}
                  onToggleStatus={() => handleToggleStatus(delivery.id)}
                />
              </Animated.View>
            ))
          ) : (
            <Animated.View
              entering={FadeInDown.duration(
                reduceMotionEnabled ? 0 : theme.animations.duration.standard,
              )}
              style={styles.emptyState}
            >
              <GlassCard
                style={[styles.emptyCard, { borderRadius: theme.radius.xl + theme.spacing.md }]}
              >
                <EmptyState />
              </GlassCard>
            </Animated.View>
          )}
        </Animated.View>
      </>
    );
  }, [
    handleDeleteDelivery,
    handleMarkDelivered,
    handleToggleStatus,
    reduceMotionEnabled,
    selectedPeriodDeliveries,
    theme,
  ]);

  const renderGroupedContent = useCallback(() => {
    const dayGroups = groupHistoryDeliveriesByDate(selectedPeriodDeliveries, selectedRange);

    if (dayGroups.length === 0) {
      return (
        <Animated.View
          entering={FadeInDown.duration(
            reduceMotionEnabled ? 0 : theme.animations.duration.standard,
          )}
          style={styles.periodEmpty}
        >
          <GlassCard
            style={[styles.emptyCard, { borderRadius: theme.radius.xl + theme.spacing.md }]}
          >
            <EmptyState />
          </GlassCard>
        </Animated.View>
      );
    }

    return (
      <View style={[styles.periodSections, { gap: theme.spacing.lg }]}>
        {dayGroups.map((group) => (
          <View key={group.date} style={[styles.periodSection, { gap: theme.spacing.xs }]}>
            <View
              style={[
                styles.dayHeadingRow,
                { gap: theme.spacing.xs, paddingHorizontal: theme.spacing.xl },
              ]}
            >
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {formatHistoryDayHeading(group.date)}
              </Text>
            </View>
            <View
              style={[
                styles.miniCards,
                { gap: theme.spacing.xs, paddingHorizontal: theme.spacing.md },
              ]}
            >
              {Array.from({ length: Math.ceil(group.deliveries.length / 3) }, (_, rowIndex) => {
                const first = group.deliveries[rowIndex * 3];
                const second = group.deliveries[rowIndex * 3 + 1];
                const third = group.deliveries[rowIndex * 3 + 2];

                return (
                  <View
                    key={`${group.date}-${rowIndex}`}
                    style={[styles.miniCardsRow, { gap: theme.spacing.sm }]}
                  >
                    <View style={styles.miniCardSlot}>
                      {first ? (
                        <HistoryCompactDeliveryCard
                          delivery={first}
                          onDelete={() => handleDeleteDelivery(first.id)}
                          onMarkDelivered={() => handleMarkDelivered(first.id)}
                        />
                      ) : null}
                    </View>
                    <View style={styles.miniCardSlot}>
                      {second ? (
                        <HistoryCompactDeliveryCard
                          delivery={second}
                          onDelete={() => handleDeleteDelivery(second.id)}
                          onMarkDelivered={() => handleMarkDelivered(second.id)}
                        />
                      ) : null}
                    </View>
                    <View style={styles.miniCardSlot}>
                      {third ? (
                        <HistoryCompactDeliveryCard
                          delivery={third}
                          onDelete={() => handleDeleteDelivery(third.id)}
                          onMarkDelivered={() => handleMarkDelivered(third.id)}
                        />
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    );
  }, [
    handleDeleteDelivery,
    handleMarkDelivered,
    reduceMotionEnabled,
    selectedPeriodDeliveries,
    selectedRange,
    theme,
  ]);

  const renderCurrentModeContent = useCallback(() => {
    if (viewMode === 'day') return renderDayContent();
    return renderGroupedContent();
  }, [renderDayContent, renderGroupedContent, viewMode]);

  const handleSelectWeek = useCallback((weekStart: string) => {
    setSelectedDate(weekStart);
    setSelectedFilter('Todos');
  }, []);

  const handleSelectViewMode = useCallback((selectedKey: string) => {
    const nextMode = HISTORY_VIEW_MODE_ITEMS.find(({ key }) => key === selectedKey)?.key;
    if (nextMode) setViewMode(nextMode);
  }, []);

  const historyToolbarItems = useMemo(
    () =>
      renderNativeDateToolbarItems({
        mode: viewMode,
        onDateChange: handleSelectDate,
        onWeekChange: handleSelectWeek,
        placement: 'right',
        selectedDate,
        weekGroups,
        weekSelection: selectedWeek,
      }),
    [handleSelectDate, handleSelectWeek, selectedDate, selectedWeek, viewMode, weekGroups],
  );

  const header = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      rightActions={
        <Text
          numberOfLines={1}
          style={[
            theme.typography.footnote,
            { color: theme.colors.textSecondary, fontVariant: ['tabular-nums'] },
          ]}
        >
          {maskQuantity(totalBuckets)}
        </Text>
      }
      titleStyle={{
        fontFamily: 'System',
        fontSize: 36,
        fontWeight: '700',
        marginLeft: -(theme.spacing.xxs * 2),
      }}
      title="Histórico"
    />
  );
  const dayContent = (
    <View
      style={[styles.dayContentContainer, { flexGrow: 1, paddingHorizontal: theme.spacing.md }]}
    >
      <View
        style={[
          styles.modeControl,
          {
            marginBottom: viewMode === 'day' ? theme.spacing.xs : theme.spacing.lg,
            marginTop: theme.spacing.md,
          },
        ]}
      >
        <NativeRetailFinanceCategorySelector
          accessibilityLabel="Modo de visualização do histórico"
          fillAvailableWidth
          items={HISTORY_VIEW_MODE_ITEMS}
          onChange={handleSelectViewMode}
          scrollable={false}
          selectionAnimationMode="slidingBubble"
          selectedKey={viewMode}
          style={{
            alignSelf: 'center',
            height: 63,
            width: '97%',
          }}
        />
      </View>
      {renderCurrentModeContent()}
    </View>
  );

  return (
    <Animated.View style={styles.root}>
      <Stack.Toolbar placement="right">{historyToolbarItems}</Stack.Toolbar>
      <ProgressiveCollapsibleScreen
        compactTitle="Histórico"
        contentGap={0}
        contentTopInset={insets.top - theme.spacing.xxs}
        largeTitle={header}
        nativeTabRoot
        largeTitleContainerStyle={{
          marginBottom: -theme.spacing.xs,
          marginTop: theme.spacing.xs,
          paddingHorizontal: theme.spacing.md,
          minHeight: 44,
        }}
        scrollContentContainerStyle={{
          paddingBottom: theme.layout.tabBarHeight + insets.bottom + theme.spacing.lg,
          paddingHorizontal: 0,
        }}
      >
        {dayContent}
      </ProgressiveCollapsibleScreen>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dayContentContainer: { position: 'relative' },
  dayHeadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  emptyState: { alignSelf: 'stretch', width: '100%' },
  emptyList: { flexGrow: 1 },
  emptyCard: { width: '100%' },
  fullWidth: { width: '100%' },
  list: { width: '100%' },
  miniCardSlot: { alignItems: 'stretch', flex: 1, minWidth: 0 },
  miniCards: { width: '100%' },
  miniCardsRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    width: '100%',
  },
  modeControl: { width: '100%' },
  periodEmpty: { width: '100%' },
  periodSection: { width: '100%' },
  periodSections: { width: '100%' },
});
