import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Stack, useFocusEffect } from 'expo-router';

import { NativeGlassHeader } from '@/components/layout';
import { NativeSegmentedControl, renderNativeDateToolbarItems } from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
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
  createHistoryWeekGroups,
  formatHistoryDayHeading,
  getHistoryMonthRange,
  getHistoryWeekRange,
  groupHistoryDeliveriesByDate,
  type HistoryDateRange,
} from '../utils/historyPeriodUtils';

type HistoryViewMode = 'day' | 'week' | 'month';

const HISTORY_VIEW_MODE_OPTIONS = ['Dia', 'Semana', 'Mês'] as const;
const HISTORY_VIEW_MODES: readonly HistoryViewMode[] = ['day', 'week', 'month'];

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
  const { enabled: testModeEnabled } = useTestModePresentation();
  const [selectedDate, setSelectedDate] = useState(() => todayIso());
  const [viewMode, setViewMode] = useState<HistoryViewMode>('day');
  const {
    reload: refresh,
    remove: removeDelivery,
    deliveries,
    toggleDelivered: toggleDelivery,
  } = useDeliveries({ mode: 'all' });
  const allDeliveries = useMemo(() => deliveries.map(toHistoryDelivery), [deliveries]);
  const selectedYear = Number(selectedDate.slice(0, 4));
  const weekGroups = useMemo(() => createHistoryWeekGroups(selectedYear), [selectedYear]);
  const [selectedFilter, setSelectedFilter] = useState<HistoryFilter>('Todos');
  const [overlayHeaderHeight, setOverlayHeaderHeight] = useState(
    () => insets.top + theme.sizes.touchTargetMinimum * 2 + theme.spacing.xs + theme.spacing.sm,
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

  const handleDeleteDelivery = useCallback(
    (deliveryId: string) => {
      if (testModeEnabled) return;
      void removeDelivery(deliveryId);
    },
    [removeDelivery, testModeEnabled],
  );

  const renderDayContent = useCallback(
    (date: string) => {
      const dayDeliveries = allDeliveries.filter((delivery) => delivery.data === date);
      const visibleDeliveries = filterDayDeliveries(dayDeliveries, selectedFilter);

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
    },
    [
      allDeliveries,
      handleDeleteDelivery,
      handleToggleStatus,
      reduceMotionEnabled,
      selectedFilter,
      theme,
    ],
  );

  const renderGroupedContent = useCallback(
    (range: HistoryDateRange) => {
      const periodDeliveries = allDeliveries.filter(
        (delivery) => delivery.data >= range.startDate && delivery.data <= range.endDate,
      );
      const visibleDeliveries =
        selectedFilter === 'Hoje'
          ? periodDeliveries.filter((delivery) => delivery.data === todayIso())
          : filterDayDeliveries(periodDeliveries, selectedFilter);
      const dayGroups = groupHistoryDeliveriesByDate(visibleDeliveries, range);

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
                          />
                        ) : null}
                      </View>
                      <View style={styles.miniCardSlot}>
                        {second ? (
                          <HistoryCompactDeliveryCard
                            delivery={second}
                            onDelete={() => handleDeleteDelivery(second.id)}
                          />
                        ) : null}
                      </View>
                      <View style={styles.miniCardSlot}>
                        {third ? (
                          <HistoryCompactDeliveryCard
                            delivery={third}
                            onDelete={() => handleDeleteDelivery(third.id)}
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
    },
    [allDeliveries, handleDeleteDelivery, reduceMotionEnabled, selectedFilter, theme],
  );

  const renderCurrentModeContent = useCallback(() => {
    if (viewMode === 'day') return renderDayContent(selectedDate);
    return renderGroupedContent(
      viewMode === 'week' ? getHistoryWeekRange(selectedDate) : getHistoryMonthRange(selectedDate),
    );
  }, [renderDayContent, renderGroupedContent, selectedDate, viewMode]);

  const handleSelectWeek = useCallback((weekStart: string) => {
    setSelectedDate(weekStart);
    setSelectedFilter('Todos');
  }, []);

  const handleSelectViewMode = useCallback((index: number) => {
    const nextMode = HISTORY_VIEW_MODES[index];
    if (nextMode) setViewMode(nextMode);
  }, []);

  const renderHistoryToolbar = useCallback(
    () =>
      renderNativeDateToolbarItems({
        mode: viewMode,
        onDateChange: handleSelectDate,
        onWeekChange: handleSelectWeek,
        placement: 'right',
        selectedDate,
        weekGroups,
      }),
    [handleSelectDate, handleSelectWeek, selectedDate, viewMode, weekGroups],
  );
  const filterHeader = (
    <NativeGlassHeader
      includeTopSafeArea
      mode="transparent"
      accessory={
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            height: theme.sizes.touchTargetMinimum + theme.spacing.sm,
            marginTop: theme.spacing.xs,
          }}
        />
      }
      title=""
    />
  );
  const header = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      titleStyle={{
        fontFamily: 'System',
        fontSize: 36,
        fontWeight: '700',
        marginLeft: -(theme.spacing.xxs * 2),
      }}
      title="Histórico"
    />
  );
  const dayContentChildren = (
    <>
      <View
        style={[
          styles.header,
          {
            marginBottom: -theme.spacing.xs,
            marginTop: theme.spacing.xs,
          },
        ]}
      >
        {header}
      </View>
      <View
        style={[
          styles.modeControl,
          {
            marginBottom: viewMode === 'day' ? theme.spacing.xs : theme.spacing.lg,
            marginTop: theme.spacing.md,
          },
        ]}
      >
        <NativeSegmentedControl
          accessibilityLabel="Modo de visualização do histórico"
          onSelectedIndexChange={handleSelectViewMode}
          options={HISTORY_VIEW_MODE_OPTIONS}
          selectedIndex={HISTORY_VIEW_MODES.indexOf(viewMode)}
          style={{
            alignSelf: 'center',
            height: 63,
            width: '97%',
          }}
        />
      </View>
      {renderCurrentModeContent()}
    </>
  );
  const dayContentStyle = {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop:
      overlayHeaderHeight -
      theme.spacing.xxxl -
      theme.spacing.xl * 2 -
      theme.spacing.md -
      theme.spacing.md -
      theme.spacing.xxs +
      theme.spacing.xs +
      theme.spacing.xxs,
  };
  const dayContent = <View style={dayContentStyle}>{dayContentChildren}</View>;

  return (
    <>
      <Stack.Toolbar placement="right">{renderHistoryToolbar()}</Stack.Toolbar>
      <Animated.View style={styles.root}>
        <PremiumScreen
          scrollable
          contentContainerStyle={{ gap: theme.spacing.lg, paddingHorizontal: 0 }}
          overlayHeader={filterHeader}
          overlayHeaderUnderlay
          onOverlayHeaderLayout={setOverlayHeaderHeight}
          progressiveBlurHeight={
            insets.top + theme.sizes.touchTargetMinimum * 2 + theme.spacing.xs + theme.spacing.sm
          }
          progressiveBlurTopOffset={-theme.spacing.xl}
          progressiveBlur
        >
          <View style={styles.dayContentContainer}>{dayContent}</View>
        </PremiumScreen>
      </Animated.View>
    </>
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
  header: { minHeight: 44 },
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
