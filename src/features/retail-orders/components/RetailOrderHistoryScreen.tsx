import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';

import { EmptyState, ErrorState, Loading } from '@/components/feedback';
import { NativeGlassHeader } from '@/components/layout';
import { NativeSegmentedControl, renderNativeDateToolbarItems } from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useAppSafeAreaInsets } from '@/providers';
import { useAppTheme } from '@/theme';
import { todayIso } from '@/utils/data';
import type { RetailOrder } from '@/types/data';
import {
  createHistoryWeekGroups,
  formatHistoryDayHeading,
  getHistoryMonthRange,
  getHistoryWeekRange,
} from '@/features/history/utils/historyPeriodUtils';
import {
  getRetailOrderHistoryFinancialCandidateOrders,
  useRetailOrderHistory,
  useRetailOrderHistoryFinancialSummaries,
} from '@/hooks/useRetailOrderHistory';
import type { RetailOrderHistoryFinancialViewState } from '@/hooks/useRetailOrderHistory';

import { RetailOrderHistoryCard } from './RetailOrderHistoryCard';
import {
  filterRetailOrdersByOrderDate,
  groupRetailOrdersByOrderDate,
} from '../utils/retailOrderHistoryUtils';

type RetailHistoryViewMode = 'day' | 'week' | 'month';

const RETAIL_HISTORY_VIEW_MODE_OPTIONS = ['Dia', 'Semana', 'Mês'] as const;
const RETAIL_HISTORY_VIEW_MODES: readonly RetailHistoryViewMode[] = ['day', 'week', 'month'];
const RETAIL_HISTORY_REFRESH_ERROR_MESSAGE =
  'Não foi possível atualizar o histórico agora. Os pedidos já carregados continuam disponíveis.';

export function RetailOrderHistoryScreen() {
  const insets = useAppSafeAreaInsets();
  const { theme } = useAppTheme();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(() => todayIso());
  const [viewMode, setViewMode] = useState<RetailHistoryViewMode>('day');
  const { error, loading, orders, reload, remoteComplete, refreshKey } = useRetailOrderHistory();
  const selectedYear = Number(selectedDate.slice(0, 4));
  const weekGroups = useMemo(() => createHistoryWeekGroups(selectedYear), [selectedYear]);
  const selectedRange = useMemo(
    () =>
      viewMode === 'week'
        ? getHistoryWeekRange(selectedDate)
        : viewMode === 'month'
          ? getHistoryMonthRange(selectedDate)
          : { endDate: selectedDate, startDate: selectedDate },
    [selectedDate, viewMode],
  );
  const visibleOrders = useMemo(
    () => filterRetailOrdersByOrderDate(orders, selectedRange),
    [orders, selectedRange],
  );
  const candidateOrders = useMemo(
    () => getRetailOrderHistoryFinancialCandidateOrders(orders, selectedDate),
    [orders, selectedDate],
  );
  const financialStates = useRetailOrderHistoryFinancialSummaries(
    visibleOrders,
    refreshKey,
    candidateOrders,
  );

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const handleSelectDate = useCallback((date: string) => setSelectedDate(date), []);
  const handleSelectWeek = useCallback((weekStart: string) => setSelectedDate(weekStart), []);
  const handleSelectViewMode = useCallback((index: number) => {
    const nextMode = RETAIL_HISTORY_VIEW_MODES[index];
    if (nextMode) setViewMode(nextMode);
  }, []);
  const handleOpenOrder = useCallback(
    (orderId: string) => {
      router.push({ pathname: '/pedido-varejo/[orderId]', params: { orderId } });
    },
    [router],
  );

  const historyToolbarItems = useMemo(
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

  const content = (
    <RetailHistoryContent
      error={error}
      financialStates={financialStates}
      loading={loading}
      onOrderPress={handleOpenOrder}
      onRetry={reload}
      orders={orders}
      remoteComplete={remoteComplete}
      selectedRange={selectedRange}
      theme={theme}
      viewMode={viewMode}
    />
  );
  const dayContentChildren = (
    <>
      <View
        style={[styles.header, { marginBottom: -theme.spacing.xs, marginTop: theme.spacing.xs }]}
      >
        {header}
      </View>
      <View
        style={[
          styles.modeControl,
          { marginBottom: theme.spacing.lg, marginTop: theme.spacing.md },
        ]}
      >
        <NativeSegmentedControl
          accessibilityLabel="Modo de visualização do histórico Varejo"
          onSelectedIndexChange={handleSelectViewMode}
          options={RETAIL_HISTORY_VIEW_MODE_OPTIONS}
          selectedIndex={RETAIL_HISTORY_VIEW_MODES.indexOf(viewMode)}
          style={{ alignSelf: 'center', height: 63, width: '97%' }}
        />
      </View>
      {content}
    </>
  );
  const dayContent = (
    <View
      style={{
        flexGrow: 1,
        paddingHorizontal: theme.spacing.md,
        paddingTop:
          insets.top +
          theme.sizes.touchTargetMinimum * 2 +
          theme.spacing.xs +
          theme.spacing.sm -
          theme.spacing.xxxl -
          theme.spacing.xl * 2 -
          theme.spacing.md -
          theme.spacing.md -
          theme.spacing.xxs +
          theme.spacing.xs +
          theme.spacing.xxs,
      }}
    >
      {dayContentChildren}
    </View>
  );

  return (
    <View style={styles.root}>
      <Stack.Toolbar placement="right">{historyToolbarItems}</Stack.Toolbar>
      <PremiumScreen
        scrollable
        contentContainerStyle={{ gap: theme.spacing.lg, paddingHorizontal: 0 }}
        overlayHeader={filterHeader}
        overlayHeaderUnderlay
        progressiveBlur
        progressiveBlurHeight={
          insets.top + theme.sizes.touchTargetMinimum * 2 + theme.spacing.xs + theme.spacing.sm
        }
        progressiveBlurTopOffset={-theme.spacing.xl}
      >
        <View style={styles.contentContainer}>{dayContent}</View>
      </PremiumScreen>
    </View>
  );
}

function RetailHistoryContent({
  error,
  financialStates,
  loading,
  onRetry,
  onOrderPress,
  orders,
  remoteComplete,
  selectedRange,
  theme,
  viewMode,
}: {
  error?: string;
  financialStates: Record<string, RetailOrderHistoryFinancialViewState>;
  loading: boolean;
  onRetry: () => void;
  onOrderPress: (orderId: string) => void;
  orders: readonly RetailOrder[];
  remoteComplete: boolean;
  selectedRange: { startDate: string; endDate: string };
  theme: ReturnType<typeof useAppTheme>['theme'];
  viewMode: RetailHistoryViewMode;
}) {
  const visibleOrders = filterRetailOrdersByOrderDate(orders, selectedRange);
  if (!visibleOrders.length && !remoteComplete) {
    if (error) {
      return (
        <ErrorState
          description="Os pedidos em cache continuam preservados. Tente atualizar novamente."
          onRetry={onRetry}
          retryLabel="Tentar novamente"
          title="Não foi possível atualizar o Histórico Varejo"
        />
      );
    }
    if (loading) {
      return (
        <GlassCard style={styles.stateCard}>
          <Loading label="Carregando pedidos Varejo…" />
        </GlassCard>
      );
    }
  }

  if (!visibleOrders.length) {
    return (
      <GlassCard style={styles.stateCard}>
        <EmptyState
          description="Não há pedidos Varejo neste período."
          title="Nenhum pedido encontrado"
        />
      </GlassCard>
    );
  }

  const cards = (items: readonly RetailOrder[]) => (
    <View style={[styles.list, { gap: theme.spacing.sm }]}>
      {items.map((order) => (
        <RetailOrderHistoryCard
          financialState={financialStates[order.orderId]}
          key={order.orderId}
          onPress={() => onOrderPress(order.orderId)}
          order={order}
        />
      ))}
    </View>
  );

  const dateHeadingStyle = [
    theme.typography.caption,
    { color: theme.colors.textSecondary, marginLeft: theme.spacing.xs },
  ];

  const content =
    viewMode === 'day' ? (
      <View style={[styles.periodSection, { gap: theme.spacing.xs }]}>
        <Text style={dateHeadingStyle}>{formatHistoryDayHeading(selectedRange.startDate)}</Text>
        {cards(visibleOrders)}
      </View>
    ) : (
      groupRetailOrdersByOrderDate(visibleOrders, selectedRange).map((group) => (
        <View key={group.date} style={[styles.periodSection, { gap: theme.spacing.xs }]}>
          <Text style={dateHeadingStyle}>{formatHistoryDayHeading(group.date)}</Text>
          {cards(group.orders)}
        </View>
      ))
    );

  return (
    <View style={[styles.periodSections, { gap: theme.spacing.lg }]}>
      {error ? (
        <Text style={[theme.typography.footnote, { color: theme.colors.danger }]}>
          {RETAIL_HISTORY_REFRESH_ERROR_MESSAGE}
        </Text>
      ) : null}
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  contentContainer: { position: 'relative' },
  header: { minHeight: 44 },
  list: { width: '100%' },
  modeControl: { width: '100%' },
  periodSection: { width: '100%' },
  periodSections: { width: '100%' },
  root: { flex: 1 },
  stateCard: { width: '100%' },
});
