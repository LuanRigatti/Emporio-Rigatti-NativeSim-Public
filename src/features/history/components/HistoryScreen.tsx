import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Stack, useFocusEffect } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';

import { NativeGlassHeader } from '@/components/layout';
import { NativeDateToolbar, type NativeMenuAction } from '@/components/native';
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
import type { HistoryFilter } from './FilterChips';

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
  const {
    reload: refresh,
    remove: removeDelivery,
    deliveries,
    toggleDelivered: toggleDelivery,
  } = useDeliveries({ mode: 'today', date: selectedDate });
  const allDeliveries = useMemo(() => deliveries.map(toHistoryDelivery), [deliveries]);
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

  const requestDatePage = useCallback((date: string, resetFilter = true) => {
    setSelectedDate(date);
    if (resetFilter) setSelectedFilter('Todos');
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
      const dayBucketCount = dayDeliveries.reduce(
        (total, delivery) => total + delivery.quantidadeBaldes,
        0,
      );

      return (
        <>
          {dayDeliveries.length > 0 ? (
            <View style={[styles.topBucketSummary, { paddingRight: theme.spacing.lg }]}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {maskQuantity(dayBucketCount)}
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
              visibleDeliveries.map((delivery) => (
                <DeliveryCard
                  contained
                  delivery={delivery}
                  key={delivery.id}
                  onDelete={() => handleDeleteDelivery(delivery.id)}
                  onToggleStatus={() => handleToggleStatus(delivery.id)}
                />
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
      maskQuantity,
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
      {renderDayContent(selectedDate)}
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
    <Animated.View style={styles.root}>
      <NativeDateToolbar
        onDateChange={handleSelectDate}
        placement="right"
        selectedDate={selectedDate}
      />
      <HistoryFilterToolbar actions={filterActions} />
      <PremiumScreen
        scrollable
        contentContainerStyle={{ gap: theme.spacing.lg, paddingHorizontal: 0 }}
        overlayHeader={filterHeader}
        overlayHeaderUnderlay
        onOverlayHeaderLayout={setOverlayHeaderHeight}
        progressiveBlurHeight={
          insets.top +
          theme.sizes.touchTargetMinimum * 2 +
          theme.spacing.xs +
          theme.spacing.sm
        }
        progressiveBlurTopOffset={-theme.spacing.xl}
        progressiveBlur
      >
        <View style={styles.dayContentContainer}>{dayContent}</View>
      </PremiumScreen>
    </Animated.View>
  );
}

function HistoryFilterToolbar({ actions }: { actions: readonly NativeMenuAction[] }) {
  const { theme } = useAppTheme();

  return (
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.Menu
        accessibilityLabel="Filtros do histórico"
        icon="line.3.horizontal.decrease"
        separateBackground={false}
        title="Filtros do histórico"
        tintColor={theme.colors.textPrimary}
      >
        {actions.map((action) => (
          <Stack.Toolbar.MenuAction
            icon={action.systemImage as SFSymbol | undefined}
            key={action.id}
            onPress={action.onPress}
          >
            {action.title}
          </Stack.Toolbar.MenuAction>
        ))}
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dayContentContainer: { position: 'relative' },
  header: { minHeight: 44 },
  emptyState: { alignSelf: 'stretch', width: '100%' },
  emptyList: { flexGrow: 1 },
  emptyCard: { width: '100%' },
  list: { width: '100%' },
  topBucketSummary: { alignItems: 'flex-end', width: '100%' },
});
