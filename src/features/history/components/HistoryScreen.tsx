import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from 'expo-router';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeDatePicker,
  NativeGlassIconButton,
  NativeGlassMenu,
  type NativeMenuAction,
} from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';
import { triggerSelectionHaptic } from '@/utils/haptics';
import { startHistoryLayoutDiagnostics } from '@/utils/historyLayoutDiagnostics';
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
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { reduceMotionEnabled, theme } = useAppTheme();
  const [selectedDate, setSelectedDate] = useState(() => todayIso());
  const {
    reload: refresh,
    remove: removeDelivery,
    deliveries,
    toggleDelivered: toggleDelivery,
  } = useDeliveries({ mode: 'today', date: selectedDate });
  const allDeliveries = useMemo(() => deliveries.map(toHistoryDelivery), [deliveries]);
  const [selectedFilter, setSelectedFilter] = useState<HistoryFilter>('Todos');
  const [isFilterPreviewVisible, setIsFilterPreviewVisible] = useState(false);
  const [overlayHeaderHeight, setOverlayHeaderHeight] = useState(
    () => insets.top + theme.sizes.touchTargetMinimum * 2 + theme.spacing.xs + theme.spacing.sm,
  );

  if (__DEV__ && isFocused) {
    startHistoryLayoutDiagnostics();
  }

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
          {dayDeliveries.length > 0 ? (
            <View style={[styles.topBucketSummary, { paddingRight: theme.spacing.lg }]}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {dayBucketCount} {dayBucketCount === 1 ? 'balde' : 'baldes'}
              </Text>
            </View>
          ) : null}
          <Animated.View
            entering={FadeIn.duration(reduceMotionEnabled ? 0 : theme.animations.duration.standard)}
            style={[
              styles.list,
              {
                gap: theme.spacing.sm,
                marginTop: theme.spacing.md,
                paddingBottom: theme.spacing.lg,
                ...(visibleDeliveries.length === 0 ? styles.emptyList : null),
              },
            ]}
          >
            {visibleDeliveries.length > 0 ? (
              <GlassCard
                style={[styles.deliveryGroup, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
              >
                {visibleDeliveries.map((delivery) => (
                  <DeliveryCard
                    contained
                    delivery={delivery}
                    key={delivery.id}
                    onDelete={() => handleDeleteDelivery(delivery.id)}
                    onToggleStatus={() => handleToggleStatus(delivery.id)}
                  />
                ))}
              </GlassCard>
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
  const filterHeader = (
    <NativeGlassHeader
      includeTopSafeArea
      mode="transparent"
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
        fontSize: 32,
        fontWeight: '700',
        marginLeft: -(theme.spacing.xxs * 2),
      }}
      title="Histórico"
    />
  );
  const dayContent = (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        paddingBottom: theme.layout.tabBarHeight + theme.spacing.xl + insets.bottom,
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
      }}
      showsVerticalScrollIndicator={false}
      style={styles.dayScroll}
    >
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
      {isFilterPreviewVisible ? (
        <FilterChips onSelectFilter={handleSelectFilter} selectedFilter={selectedFilter} />
      ) : null}
      {renderDayContent(selectedDate)}
    </ScrollView>
  );

  return (
    <Animated.View style={styles.root}>
      <PremiumScreen
        startupDiagnosticsLabel="Historico"
        scrollable={false}
        contentContainerStyle={[
          styles.screenContent,
          {
            gap: theme.spacing.lg,
            paddingHorizontal: 0,
            paddingBottom: 0,
          },
        ]}
        overlayHeader={filterHeader}
        overlayHeaderUnderlay
        onOverlayHeaderLayout={setOverlayHeaderHeight}
        progressiveBlurHeight={
          theme.spacing.xxxl + theme.spacing.xs * 2 + theme.spacing.xl + theme.spacing.sm
        }
        progressiveBlurTopOffset={0}
        progressiveBlur
      >
        <View style={styles.dayContentContainer}>{dayContent}</View>
      </PremiumScreen>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screenContent: { flex: 1 },
  dayContentContainer: { flex: 1, minHeight: 0, position: 'relative' },
  deliveryGroup: { padding: 0 },
  header: { minHeight: 44 },
  emptyState: { alignSelf: 'stretch', width: '100%' },
  emptyList: { flex: 1 },
  historyEmptyContent: { flex: 1, minHeight: 0 },
  list: { width: '100%' },
  dayScroll: { flex: 1 },
  topBucketSummary: { alignItems: 'flex-end', width: '100%' },
});
