import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeGlassIconButton,
  NativeGlassMenu,
  NativePeriodActionGroup,
  type NativeMenuAction,
} from '@/components/native';
import { PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';
import { triggerSelectionHaptic } from '@/utils/haptics';

import { historyMockDeliveries, type DeliveryStatus } from '../data/historyMocks';
import {
  getAddedHistoryDeliveries,
  subscribeToAddedHistoryDeliveries,
} from '../data/historyDeliveryStore';
import { openInAppleMapsMock, openInWazeMock } from '../utils/locationActionsMock';
import {
  createHistoryDate,
  generateHistoryCalendarDays,
  getCurrentHistoryPeriod,
  getInitialHistoryDate,
} from '../utils/historyDateUtils';
import { BottomFadeOverlay, HISTORY_BOTTOM_FADE_HEIGHT } from './BottomFadeOverlay';
import { DeliveryCard } from './DeliveryCard';
import { EmptyState } from './EmptyState';
import { FilterChips, type HistoryFilter } from './FilterChips';
import { HorizontalCalendar } from './HorizontalCalendar';
import { getHistoryYearItems, HISTORY_MONTH_ITEMS } from './periodOptions';

export function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { reduceMotionEnabled, theme } = useAppTheme();
  const addedDeliveries = useSyncExternalStore(
    subscribeToAddedHistoryDeliveries,
    getAddedHistoryDeliveries,
    getAddedHistoryDeliveries,
  );
  const allDeliveries = useMemo(
    () => [...addedDeliveries, ...historyMockDeliveries],
    [addedDeliveries],
  );
  const initialPeriod = getCurrentHistoryPeriod();
  const [selectedMonth, setSelectedMonth] = useState(initialPeriod.month);
  const [selectedYear, setSelectedYear] = useState(initialPeriod.year);
  const [selectedDate, setSelectedDate] = useState(() =>
    getInitialHistoryDate(initialPeriod.year, initialPeriod.month, allDeliveries),
  );
  const [selectedFilter, setSelectedFilter] = useState<HistoryFilter>('Todos');
  const [isFilterPreviewVisible, setIsFilterPreviewVisible] = useState(false);
  const [deliveryStatuses, setDeliveryStatuses] = useState<Record<string, DeliveryStatus>>(() =>
    Object.fromEntries(allDeliveries.map((delivery) => [delivery.id, delivery.status])),
  );
  const latestAddedDelivery = addedDeliveries[0];
  const latestAddedDeliveryId = latestAddedDelivery?.id;
  const latestAddedDeliveryDate = latestAddedDelivery?.data;

  useEffect(() => {
    if (!latestAddedDeliveryId || !latestAddedDeliveryDate) return;
    const [year, month] = latestAddedDeliveryDate.split('-').map(Number);
    setSelectedYear(year);
    setSelectedMonth(month);
    setSelectedDate(latestAddedDeliveryDate);
    setSelectedFilter('Todos');
  }, [latestAddedDeliveryDate, latestAddedDeliveryId]);
  const calendarDays = useMemo(
    () => generateHistoryCalendarDays(selectedYear, selectedMonth),
    [selectedMonth, selectedYear],
  );
  const datesWithDeliveries = useMemo(
    () => new Set(allDeliveries.map((delivery) => delivery.data)),
    [allDeliveries],
  );

  const deliveriesForDate = useMemo(
    () =>
      allDeliveries
        .filter((delivery) => delivery.data === selectedDate)
        .map((delivery) => ({
          ...delivery,
          status: deliveryStatuses[delivery.id] ?? delivery.status,
        })),
    [allDeliveries, deliveryStatuses, selectedDate],
  );

  const filteredDeliveries = useMemo(() => {
    if (selectedFilter === 'Concluídas') {
      return deliveriesForDate.filter((delivery) => delivery.status === 'concluída');
    }

    if (selectedFilter === 'Pendentes') {
      return deliveriesForDate.filter((delivery) => delivery.status === 'pendente');
    }

    return deliveriesForDate;
  }, [deliveriesForDate, selectedFilter]);

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
    setSelectedFilter('Todos');
  }, []);

  const handleMonthChange = useCallback(
    (month: number) => {
      setSelectedMonth(month);
      setSelectedDate(getInitialHistoryDate(selectedYear, month, allDeliveries));
      setSelectedFilter('Todos');
    },
    [allDeliveries, selectedYear],
  );

  const handleYearChange = useCallback(
    (year: number) => {
      setSelectedYear(year);
      setSelectedDate(getInitialHistoryDate(year, selectedMonth, allDeliveries));
      setSelectedFilter('Todos');
    },
    [allDeliveries, selectedMonth],
  );

  const handleFilterPress = useCallback(() => {
    triggerSelectionHaptic();
    setIsFilterPreviewVisible((current) => !current);
  }, []);

  const handleSelectFilter = useCallback((filter: HistoryFilter) => {
    setSelectedFilter(filter);

    if (filter === 'Hoje') {
      const currentPeriod = getCurrentHistoryPeriod();
      setSelectedMonth(currentPeriod.month);
      setSelectedYear(currentPeriod.year);
      setSelectedDate(
        createHistoryDate(currentPeriod.year, currentPeriod.month, new Date().getDate()),
      );
    }
  }, []);

  const handleToggleStatus = useCallback((deliveryId: string) => {
    triggerSelectionHaptic();
    setDeliveryStatuses((current) => ({
      ...current,
      [deliveryId]: current[deliveryId] === 'pendente' ? 'concluída' : 'pendente',
    }));
  }, []);

  const handleOpenWaze = useCallback(() => {
    openInWazeMock();
  }, []);

  const handleOpenAppleMaps = useCallback(() => {
    openInAppleMapsMock();
  }, []);
  const filterActions: readonly NativeMenuAction[] = [
    {
      id: 'completed',
      onPress: () => handleSelectFilter('Concluídas'),
      systemImage: 'checkmark.circle',
      title: 'Concluídas',
    },
    {
      id: 'pending',
      onPress: () => handleSelectFilter('Pendentes'),
      systemImage: 'clock',
      title: 'Pendentes',
    },
    {
      id: 'today',
      onPress: () => handleSelectFilter('Hoje'),
      systemImage: 'calendar',
      title: 'Hoje',
    },
  ];
  const header = (
    <NativeGlassHeader
      mode="transparent"
      titleStyle={{ transform: [{ translateX: -(theme.spacing.lg + theme.spacing.xs) }] }}
      leftActions={
        <NativePeriodActionGroup
          color={theme.colors.textPrimary}
          monthItems={HISTORY_MONTH_ITEMS}
          onMonthChange={handleMonthChange}
          onYearChange={handleYearChange}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          yearItems={getHistoryYearItems()}
        />
      }
      rightActions={
        <NativeGlassMenu
          accessibilityLabel="Filtros do histórico"
          actions={filterActions}
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          fallbackIcon="filter-outline"
          size={theme.sizes.iconMedium}
          systemImage="line.3.horizontal.decrease.circle"
          trigger={
            <NativeGlassIconButton
              accessibilityLabel="Filtros do histórico"
              color={theme.colors.textPrimary}
              containerSize={theme.sizes.touchTargetMinimum}
              fallbackIcon="filter-outline"
              interactiveGlass
              onPress={handleFilterPress}
              size={theme.sizes.iconMedium}
              systemImage="line.3.horizontal.decrease.circle"
            />
          }
        />
      }
      title="Histórico"
    />
  );

  return (
    <Animated.View style={styles.root}>
      <PremiumScreen
        scrollViewProps={{
          scrollEventThrottle: 16,
        }}
        contentContainerStyle={[
          styles.screenContent,
          {
            gap: theme.spacing.lg,
            paddingBottom:
              theme.layout.tabBarHeight +
              HISTORY_BOTTOM_FADE_HEIGHT +
              theme.spacing.xl +
              insets.bottom,
          },
        ]}
        overlayHeader={header}
        overlayHeaderContentOffset={theme.spacing.sm + theme.spacing.xxs * 7}
        progressiveBlur
      >
        <HorizontalCalendar
          days={calendarDays}
          datesWithDeliveries={datesWithDeliveries}
          onSelectDate={handleSelectDate}
          selectedDate={selectedDate}
        />
        {isFilterPreviewVisible ? (
          <FilterChips onSelectFilter={handleSelectFilter} selectedFilter={selectedFilter} />
        ) : null}

        <Animated.View
          entering={FadeIn.duration(reduceMotionEnabled ? 0 : theme.animations.duration.standard)}
          style={[
            styles.list,
            {
              gap: theme.spacing.sm,
              marginTop: theme.spacing.sm - theme.spacing.xxs * 2,
            },
          ]}
        >
          {filteredDeliveries.length > 0 ? (
            filteredDeliveries.map((delivery, index) => (
              <Animated.View
                entering={FadeIn.delay(reduceMotionEnabled ? 0 : index * 40).duration(
                  reduceMotionEnabled ? 0 : theme.animations.duration.standard,
                )}
                key={delivery.id}
              >
                <DeliveryCard
                  delivery={delivery}
                  onOpenAppleMaps={handleOpenAppleMaps}
                  onOpenWaze={handleOpenWaze}
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
              <EmptyState />
            </Animated.View>
          )}
        </Animated.View>
      </PremiumScreen>
      <BottomFadeOverlay />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screenContent: { flexGrow: 0 },
  emptyState: { alignSelf: 'stretch', width: '100%' },
  list: { width: '100%' },
});
