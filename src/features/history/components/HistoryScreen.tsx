import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { HistoryHeader } from './HistoryHeader';
import { HorizontalCalendar } from './HorizontalCalendar';

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
      >
        <HistoryHeader
          onFilterPress={handleFilterPress}
          onFilterSelect={handleSelectFilter}
          onMonthChange={handleMonthChange}
          onYearChange={handleYearChange}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
        />
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
          style={[styles.list, { gap: theme.spacing.sm, marginTop: theme.spacing.sm }]}
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
