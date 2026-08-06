import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

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
import { toHistoryDelivery } from '@/services/data';
import { useAppData } from '@/hooks/useAppData';

import {
  createHistoryDate,
  generateHistoryCalendarDays,
  getCurrentHistoryPeriod,
  getInitialHistoryDate,
} from '../utils/historyDateUtils';
import { DeliveryCard } from './DeliveryCard';
import { EmptyState } from './EmptyState';
import { FilterChips, type HistoryFilter } from './FilterChips';
import { HorizontalCalendar } from './HorizontalCalendar';
import { getHistoryYearItems, HISTORY_MONTH_ITEMS } from './periodOptions';

function monthShortLabel(month: number): string {
  return (
    ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][
      month - 1
    ] ?? String(month)
  );
}

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
  const insets = useSafeAreaInsets();
  const { reduceMotionEnabled, theme } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { refresh, snapshot, toggleDelivery } = useAppData();
  const allDeliveries = useMemo(
    () => (snapshot?.entregas ?? []).map(toHistoryDelivery),
    [snapshot],
  );
  const initialPeriod = getCurrentHistoryPeriod();
  const [selectedMonth, setSelectedMonth] = useState(initialPeriod.month);
  const [selectedYear, setSelectedYear] = useState(initialPeriod.year);
  const [selectedDate, setSelectedDate] = useState(() =>
    getInitialHistoryDate(initialPeriod.year, initialPeriod.month, allDeliveries),
  );
  const [selectedFilter, setSelectedFilter] = useState<HistoryFilter>('Todos');
  const [isFilterPreviewVisible, setIsFilterPreviewVisible] = useState(false);
  const [overlayHeaderHeight, setOverlayHeaderHeight] = useState(0);
  const [pagerRequestID, setPagerRequestID] = useState(0);
  const [pagerWidth, setPagerWidth] = useState(0);
  const [pagerHeight, setPagerHeight] = useState(0);
  const pagerRef = useRef<ScrollView>(null);
  const lastPagerRequestIDRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const calendarDays = useMemo(
    () => generateHistoryCalendarDays(selectedYear, selectedMonth),
    [selectedMonth, selectedYear],
  );
  const selectedPageIndex = useMemo(
    () =>
      Math.max(
        0,
        calendarDays.findIndex((day) => day.date === selectedDate),
      ),
    [calendarDays, selectedDate],
  );
  const selectedPageIndexRef = useRef(selectedPageIndex);
  useEffect(() => {
    selectedPageIndexRef.current = selectedPageIndex;
  }, [selectedPageIndex]);
  const datesWithDeliveries = useMemo(
    () => new Set(allDeliveries.map((delivery) => delivery.data)),
    [allDeliveries],
  );

  const requestDatePage = useCallback((date: string, resetFilter = true) => {
    setSelectedDate(date);
    if (resetFilter) setSelectedFilter('Todos');
    setPagerRequestID((requestID) => requestID + 1);
  }, []);

  const handleSelectDate = useCallback(
    (date: string) => {
      requestDatePage(date);
    },
    [requestDatePage],
  );

  const handleMonthChange = useCallback(
    (month: number) => {
      const nextDate = getInitialHistoryDate(selectedYear, month, allDeliveries);
      setSelectedMonth(month);
      requestDatePage(nextDate);
    },
    [allDeliveries, requestDatePage, selectedYear],
  );

  const handleYearChange = useCallback(
    (year: number) => {
      const nextDate = getInitialHistoryDate(year, selectedMonth, allDeliveries);
      setSelectedYear(year);
      requestDatePage(nextDate);
    },
    [allDeliveries, requestDatePage, selectedMonth],
  );

  const handleFilterPress = useCallback(() => {
    triggerSelectionHaptic();
    setIsFilterPreviewVisible((current) => !current);
  }, []);

  const handleSelectFilter = useCallback(
    (filter: HistoryFilter) => {
      setSelectedFilter(filter);

      if (filter === 'Hoje') {
        const currentPeriod = getCurrentHistoryPeriod();
        setSelectedMonth(currentPeriod.month);
        setSelectedYear(currentPeriod.year);
        requestDatePage(
          createHistoryDate(currentPeriod.year, currentPeriod.month, new Date().getDate()),
          false,
        );
      }
    },
    [requestDatePage],
  );

  const handleToggleStatus = useCallback(
    (deliveryId: string) => {
      triggerSelectionHaptic();
      void toggleDelivery(deliveryId);
    },
    [toggleDelivery],
  );

  useEffect(() => {
    if (pagerWidth <= 0) return;

    const animated = lastPagerRequestIDRef.current !== pagerRequestID;
    pagerRef.current?.scrollTo({
      animated,
      x: selectedPageIndexRef.current * pagerWidth,
      y: 0,
    });
    lastPagerRequestIDRef.current = pagerRequestID;
  }, [pagerRequestID, pagerWidth]);

  const handlePagerScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      if (pagerWidth <= 0) return;
      const page = Math.round(event.nativeEvent.contentOffset.x / pagerWidth);
      const nextDate = calendarDays[page]?.date;
      if (!nextDate || nextDate === selectedDate) return;
      setSelectedDate(nextDate);
      setSelectedFilter('Todos');
    },
    [calendarDays, pagerWidth, selectedDate],
  );

  const handlePagerMomentumEnd = useCallback(
    (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      if (pagerWidth <= 0) return;
      const page = Math.round(event.nativeEvent.contentOffset.x / pagerWidth);
      const nextDate = calendarDays[page]?.date;
      if (!nextDate || nextDate === selectedDate) return;
      setSelectedDate(nextDate);
      setSelectedFilter('Todos');
    },
    [calendarDays, pagerWidth, selectedDate],
  );

  const renderDayContent = useCallback(
    (date: string) => {
      const dayDeliveries = allDeliveries.filter((delivery) => delivery.data === date);
      const visibleDeliveries = filterDayDeliveries(dayDeliveries, selectedFilter);
      const dayBucketCount = dayDeliveries.reduce(
        (total, delivery) => total + delivery.quantidadeBaldes,
        0,
      );

      return (
        <>
          <View style={styles.bucketSummary}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              {dayBucketCount > 0
                ? `${dayBucketCount} ${dayBucketCount === 1 ? 'balde' : 'baldes'}`
                : '0 entregas'}
            </Text>
          </View>
          <Animated.View
            entering={FadeIn.duration(reduceMotionEnabled ? 0 : theme.animations.duration.standard)}
            style={[
              styles.list,
              {
                gap: theme.spacing.sm,
                marginTop: theme.spacing.sm,
                paddingBottom: theme.spacing.lg,
              },
            ]}
          >
            {visibleDeliveries.length > 0 ? (
              visibleDeliveries.map((delivery, index) => (
                <Animated.View
                  entering={FadeIn.delay(reduceMotionEnabled ? 0 : index * 40).duration(
                    reduceMotionEnabled ? 0 : theme.animations.duration.standard,
                  )}
                  key={delivery.id}
                >
                  <DeliveryCard
                    delivery={delivery}
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
        </>
      );
    },
    [allDeliveries, handleToggleStatus, reduceMotionEnabled, selectedFilter, theme],
  );

  const dayContent = (
    <ScrollView
      decelerationRate="fast"
      directionalLockEnabled
      horizontal
      onLayout={(event) => {
        setPagerWidth(event.nativeEvent.layout.width);
        setPagerHeight(event.nativeEvent.layout.height);
      }}
      onScroll={handlePagerScroll}
      onMomentumScrollEnd={handlePagerMomentumEnd}
      pagingEnabled
      contentContainerStyle={{ alignItems: 'stretch', flexGrow: 0 }}
      ref={pagerRef}
      scrollEventThrottle={16}
      showsHorizontalScrollIndicator={false}
      style={styles.pager}
    >
      {calendarDays.map((day) => (
        <View
          key={day.date}
          style={[
            styles.pagerPage,
            {
              height: pagerHeight || undefined,
              width: pagerWidth || Math.max(1, windowWidth),
            },
          ]}
        >
          <ScrollView
            contentContainerStyle={{
              paddingBottom: theme.layout.tabBarHeight + theme.spacing.xl + insets.bottom,
              paddingHorizontal: theme.spacing.md,
              paddingTop: overlayHeaderHeight + theme.spacing.lg,
            }}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.dayScroll}
          >
            {renderDayContent(day.date)}
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  );

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
      titleStyle={{ transform: [{ translateX: theme.spacing.lg + theme.spacing.xs }] }}
      leftActions={
        <NativeGlassMenu
          accessibilityLabel="Filtros do histórico"
          actions={filterActions}
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          fallbackIcon="filter-outline"
          size={theme.sizes.iconMedium}
          systemImage="line.3.horizontal.decrease"
          style={{
            height: theme.sizes.touchTargetMinimum,
            width: theme.sizes.touchTargetMinimum,
          }}
          trigger={
            <NativeGlassIconButton
              accessibilityLabel="Filtros do histórico"
              color={theme.colors.textPrimary}
              containerSize={theme.sizes.touchTargetMinimum}
              fallbackIcon="filter-outline"
              interactiveGlass
              onPress={handleFilterPress}
              size={theme.sizes.iconMedium}
              systemImage="line.3.horizontal.decrease"
            />
          }
        />
      }
      accessory={
        <View style={{ marginTop: theme.spacing.xs }}>
          <HorizontalCalendar
            days={calendarDays}
            datesWithDeliveries={datesWithDeliveries}
            onSelectDate={handleSelectDate}
            selectedDate={selectedDate}
          />
        </View>
      }
      rightActions={
        <NativePeriodActionGroup
          color={theme.colors.textPrimary}
          monthDisplayValue={monthShortLabel(selectedMonth)}
          monthItems={HISTORY_MONTH_ITEMS}
          onMonthChange={handleMonthChange}
          onYearChange={handleYearChange}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          showValues
          valueFontSize={17}
          yearItems={getHistoryYearItems()}
        />
      }
      title="Histórico"
    />
  );

  return (
    <Animated.View style={styles.root}>
      <PremiumScreen
        scrollable={false}
        contentContainerStyle={[
          styles.screenContent,
          {
            gap: theme.spacing.lg,
            paddingHorizontal: 0,
            paddingBottom: 0,
          },
        ]}
        overlayHeader={header}
        overlayHeaderContentOffset={0}
        overlayHeaderSpacing={theme.spacing.lg}
        overlayHeaderUnderlay
        onOverlayHeaderLayout={setOverlayHeaderHeight}
        progressiveBlurHeight={
          insets.top + theme.sizes.touchTargetMinimum + theme.spacing.xxxl + theme.spacing.xs * 5
        }
        progressiveBlurFadeStart={insets.top + theme.sizes.touchTargetMinimum}
        progressiveBlurIntensity={45}
        progressiveBlurTopOffset={0}
        progressiveBlur
      >
        {isFilterPreviewVisible ? (
          <FilterChips onSelectFilter={handleSelectFilter} selectedFilter={selectedFilter} />
        ) : null}

        <View style={styles.dayContentContainer}>{dayContent}</View>
      </PremiumScreen>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screenContent: { flex: 1 },
  dayContentContainer: { flex: 1, minHeight: 0, position: 'relative' },
  bucketSummary: { alignItems: 'center', width: '100%' },
  emptyState: { alignSelf: 'stretch', width: '100%' },
  list: { width: '100%' },
  dayScroll: { flex: 1 },
  pager: { flex: 1, flexShrink: 0, width: '100%' },
  pagerPage: { flexGrow: 1, flexShrink: 0 },
});
