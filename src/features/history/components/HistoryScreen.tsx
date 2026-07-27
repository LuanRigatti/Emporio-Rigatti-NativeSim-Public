import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface, PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';
import { triggerSelectionHaptic } from '@/utils/haptics';

import { historyMockDeliveries, type DeliveryStatus } from '../data/historyMocks';
import { openInAppleMapsMock, openInWazeMock } from '../utils/locationActionsMock';
import {
  createHistoryDate,
  generateHistoryCalendarDays,
  getCurrentHistoryPeriod,
  getInitialHistoryDate,
} from '../utils/historyDateUtils';
import { BottomFadeOverlay, HISTORY_BOTTOM_FADE_HEIGHT } from './BottomFadeOverlay';
import { DeliveryCard } from './DeliveryCard';
import { DeliveryActionsPopover, type DeliveryActionsAnchorRect } from './DeliveryActionsPopover';
import { EmptyState } from './EmptyState';
import { FilterChips, type HistoryFilter } from './FilterChips';
import { HistoryHeader } from './HistoryHeader';
import { HorizontalCalendar } from './HorizontalCalendar';

export function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { reduceMotionEnabled, theme } = useAppTheme();
  const initialPeriod = getCurrentHistoryPeriod();
  const [selectedMonth, setSelectedMonth] = useState(initialPeriod.month);
  const [selectedYear, setSelectedYear] = useState(initialPeriod.year);
  const [selectedDate, setSelectedDate] = useState(() =>
    getInitialHistoryDate(initialPeriod.year, initialPeriod.month, historyMockDeliveries),
  );
  const [selectedFilter, setSelectedFilter] = useState<HistoryFilter>('Todos');
  const [isFilterPreviewVisible, setIsFilterPreviewVisible] = useState(false);
  const [deliveryStatuses, setDeliveryStatuses] = useState<Record<string, DeliveryStatus>>(() =>
    Object.fromEntries(historyMockDeliveries.map((delivery) => [delivery.id, delivery.status])),
  );
  const [actionsPopover, setActionsPopover] = useState<{
    deliveryId: string;
    anchorRect: DeliveryActionsAnchorRect;
  } | null>(null);

  const calendarDays = useMemo(
    () => generateHistoryCalendarDays(selectedYear, selectedMonth),
    [selectedMonth, selectedYear],
  );
  const datesWithDeliveries = useMemo(
    () => new Set(historyMockDeliveries.map((delivery) => delivery.data)),
    [],
  );

  const deliveriesForDate = useMemo(
    () =>
      historyMockDeliveries
        .filter((delivery) => delivery.data === selectedDate)
        .map((delivery) => ({
          ...delivery,
          status: deliveryStatuses[delivery.id] ?? delivery.status,
        })),
    [deliveryStatuses, selectedDate],
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
    triggerSelectionHaptic();
    setSelectedDate(date);
    setSelectedFilter('Todos');
  }, []);

  const handleMonthChange = useCallback(
    (month: number) => {
      setSelectedMonth(month);
      setSelectedDate(getInitialHistoryDate(selectedYear, month, historyMockDeliveries));
      setSelectedFilter('Todos');
      setActionsPopover(null);
    },
    [selectedYear],
  );

  const handleYearChange = useCallback(
    (year: number) => {
      setSelectedYear(year);
      setSelectedDate(getInitialHistoryDate(year, selectedMonth, historyMockDeliveries));
      setSelectedFilter('Todos');
      setActionsPopover(null);
    },
    [selectedMonth],
  );

  const handleFilterPress = useCallback(() => {
    triggerSelectionHaptic();
    setIsFilterPreviewVisible((current) => !current);
  }, []);

  const handleSelectFilter = useCallback((filter: HistoryFilter) => {
    triggerSelectionHaptic();
    setSelectedFilter(filter);

    if (filter === 'Hoje') {
      const currentPeriod = getCurrentHistoryPeriod();
      setSelectedMonth(currentPeriod.month);
      setSelectedYear(currentPeriod.year);
      setSelectedDate(
        createHistoryDate(currentPeriod.year, currentPeriod.month, new Date().getDate()),
      );
      setActionsPopover(null);
    }
  }, []);

  const handleToggleStatus = useCallback((deliveryId: string) => {
    triggerSelectionHaptic();
    setDeliveryStatuses((current) => ({
      ...current,
      [deliveryId]: current[deliveryId] === 'pendente' ? 'concluída' : 'pendente',
    }));
  }, []);

  const handleOpenActions = useCallback(
    (deliveryId: string, anchorRect: DeliveryActionsAnchorRect) => {
      setActionsPopover((current) =>
        current?.deliveryId === deliveryId ? null : { anchorRect, deliveryId },
      );
    },
    [],
  );

  const handleCloseActions = useCallback(() => {
    setActionsPopover(null);
  }, []);

  const handleOpenWaze = useCallback(() => {
    openInWazeMock();
    handleCloseActions();
  }, [handleCloseActions]);

  const handleOpenAppleMaps = useCallback(() => {
    openInAppleMapsMock();
    handleCloseActions();
  }, [handleCloseActions]);

  return (
    <Animated.View style={styles.root}>
      <PremiumScreen
        scrollViewProps={{
          onScroll: handleCloseActions,
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
        <FilterChips onSelectFilter={handleSelectFilter} selectedFilter={selectedFilter} />

        {isFilterPreviewVisible ? (
          <GlassSurface
            accessibilityLiveRegion="polite"
            style={[
              styles.filterNotice,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.glassBorder,
                borderRadius: theme.radius.lg,
                padding: theme.spacing.sm,
              },
            ]}
          >
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              Filtros prontos para uma futura implementação.
            </Text>
          </GlassSurface>
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
                  isLocationExpanded={actionsPopover?.deliveryId === delivery.id}
                  onOpenActions={(anchorRect) => handleOpenActions(delivery.id, anchorRect)}
                  onToggleStatus={() => handleToggleStatus(delivery.id)}
                />
              </Animated.View>
            ))
          ) : (
            <Animated.View
              entering={FadeInDown.duration(
                reduceMotionEnabled ? 0 : theme.animations.duration.standard,
              )}
            >
              <EmptyState onBackToToday={() => handleSelectFilter('Hoje')} />
            </Animated.View>
          )}
        </Animated.View>
      </PremiumScreen>
      <BottomFadeOverlay />
      {actionsPopover ? (
        <DeliveryActionsPopover
          anchorRect={actionsPopover.anchorRect}
          onClose={handleCloseActions}
          onOpenAppleMaps={handleOpenAppleMaps}
          onOpenWaze={handleOpenWaze}
          visible
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screenContent: { flexGrow: 0 },
  filterNotice: { alignItems: 'center' },
  list: { width: '100%' },
});
