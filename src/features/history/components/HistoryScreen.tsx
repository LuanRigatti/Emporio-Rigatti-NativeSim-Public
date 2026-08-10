import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeDatePicker,
  NativeGlassIconButton,
  NativeGlassMenu,
  type NativeMenuAction,
} from '@/components/native';
import { PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';
import { triggerSelectionHaptic } from '@/utils/haptics';
import { toHistoryDelivery } from '@/services/data';
import { useDeliveries } from '@/hooks/useDeliveries';
import { parseIsoCalendarDate, todayIso } from '@/utils/data';

import { DeliveryCard } from './DeliveryCard';
import { EmptyState } from './EmptyState';
import { FilterChips, type HistoryFilter } from './FilterChips';

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
  const [selectedDate, setSelectedDate] = useState(() => todayIso());
  const { reload: refresh, remove: removeDelivery, deliveries, toggleDelivered: toggleDelivery } =
    useDeliveries({ mode: 'today', date: selectedDate });
  const allDeliveries = useMemo(
    () => deliveries.map(toHistoryDelivery),
    [deliveries],
  );
  const [selectedFilter, setSelectedFilter] = useState<HistoryFilter>('Todos');
  const [isFilterPreviewVisible, setIsFilterPreviewVisible] = useState(false);
  const [overlayHeaderHeight, setOverlayHeaderHeight] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(todayIso(date));
    setSelectedFilter('Todos');
  }, []);

  const requestDatePage = useCallback((date: string, resetFilter = true) => {
    setSelectedDate(date);
    if (resetFilter) setSelectedFilter('Todos');
  }, []);

  const handleFilterPress = useCallback(() => {
    triggerSelectionHaptic();
    setIsFilterPreviewVisible((current) => !current);
  }, []);

  const handleSelectFilter = useCallback(
    (filter: HistoryFilter) => {
      setSelectedFilter(filter);

      if (filter === 'Hoje') {
        requestDatePage(todayIso(), false);
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

  const handleDeleteDelivery = useCallback(
    (deliveryId: string) => {
      void removeDelivery(deliveryId);
    },
    [removeDelivery],
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
          <Animated.View
            entering={FadeIn.duration(reduceMotionEnabled ? 0 : theme.animations.duration.standard)}
            style={[
              styles.list,
              {
                gap: theme.spacing.sm,
                marginTop:
                  visibleDeliveries.length === 0 ? 0 : -(theme.spacing.xxl * 2 + theme.spacing.md),
                paddingBottom: theme.spacing.lg,
                ...(visibleDeliveries.length === 0 ? styles.emptyList : null),
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
                <EmptyState
                  style={[styles.historyEmptyContent, { paddingTop: theme.spacing.xxxl * 3 }]}
                />
              </Animated.View>
            )}
          </Animated.View>
          {dayDeliveries.length > 0 ? (
            <View style={styles.bottomBucketSummary}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {dayBucketCount} {dayBucketCount === 1 ? 'balde' : 'baldes'}
              </Text>
            </View>
          ) : null}
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

  const dayContent = (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        paddingBottom: theme.layout.tabBarHeight + theme.spacing.xl + insets.bottom,
        paddingHorizontal: theme.spacing.md,
        paddingTop: overlayHeaderHeight - theme.spacing.md,
      }}
      showsVerticalScrollIndicator={false}
      style={styles.dayScroll}
    >
      {renderDayContent(selectedDate)}
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
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            height: theme.sizes.touchTargetMinimum + theme.spacing.sm,
            marginTop: theme.spacing.xs,
          }}
        />
      }
      rightActions={
        <NativeDatePicker
          accessibilityLabel="Selecionar dia do histórico"
          mode="date"
          onChange={handleSelectDate}
          style="compact"
          value={parseIsoCalendarDate(selectedDate) ?? new Date()}
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
  emptyState: { alignSelf: 'stretch', width: '100%' },
  emptyList: { flex: 1 },
  historyEmptyContent: { flex: 1, minHeight: 0 },
  list: { width: '100%' },
  dayScroll: { flex: 1 },
  bottomBucketSummary: { alignItems: 'center', width: '100%' },
});
