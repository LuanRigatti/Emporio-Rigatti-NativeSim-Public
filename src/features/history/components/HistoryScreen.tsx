import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Stack, useFocusEffect } from 'expo-router';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeRetailFinanceCategorySelector,
  renderNativeDateToolbarItems,
} from '@/components/native';
import { GlassCard, ProgressiveCollapsibleScreen } from '@/components/premium';
import { useAppSafeAreaInsets, useAuth } from '@/providers';
import { useAppTheme } from '@/theme';
import { triggerSelectionHaptic } from '@/utils/haptics';
import { useDeliveries } from '@/hooks/useDeliveries';
import type { Delivery, DeliveryPaymentSelection } from '@/types/data';
import { formatCurrency, todayIso } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import { toHistoryDelivery } from '@/services/data';
import HistoryPaymentSheet from './HistoryPaymentSheet';

import { DeliveryCard } from './DeliveryCard';
import { EmptyState } from './EmptyState';
import { HistoryCompactDeliveryCard } from './HistoryCompactDeliveryCard';
import type { HistoryFilter } from './FilterChips';
import {
  createWholesaleHistoryWeekGroups,
  createStableListReferenceResolver,
  formatHistoryDayHeading,
  getHistoryMonthRange,
  getWholesaleHistoryWeekRange,
  groupHistoryDeliveriesByDate,
} from '../utils/historyPeriodUtils';
import { createHistoryDeliveryProjector } from '../utils/historyDeliveryProjection';

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

function getPaymentSelection(delivery: Delivery): DeliveryPaymentSelection {
  if (delivery.status !== 'Pago') return 'Não Pago';
  return delivery.metodoPagamento === 'Pix' || delivery.metodoPagamento === 'Dinheiro'
    ? delivery.metodoPagamento
    : 'Pix';
}

function hasKnownPaymentMethod(delivery: Delivery | undefined): boolean {
  return delivery?.metodoPagamento === 'Pix' || delivery?.metodoPagamento === 'Dinheiro';
}

export function HistoryScreen() {
  const { sessionVersion, user } = useAuth();
  const insets = useAppSafeAreaInsets();
  const { reduceMotionEnabled, theme } = useAppTheme();
  const {
    enabled: testModeEnabled,
    quantity: maskQuantity,
    text: maskText,
  } = useTestModePresentation();
  const [selectedDate, setSelectedDate] = useState(() => todayIso());
  const [viewMode, setViewMode] = useState<HistoryViewMode>('day');
  const {
    reload: refresh,
    remove: removeDelivery,
    deliveries,
    setDelivered,
    updateHistoryWorkflow,
  } = useDeliveries({ mode: 'all' }, { scope: 'historical' });
  const [settlementDeliveryId, setSettlementDeliveryId] = useState<string | null>(null);
  const [settlementDelivered, setSettlementDelivered] = useState(false);
  const [settlementPaymentSelection, setSettlementPaymentSelection] =
    useState<DeliveryPaymentSelection>('Não Pago');
  const [settlementPaymentSelectionChanged, setSettlementPaymentSelectionChanged] = useState(false);
  const [settlementError, setSettlementError] = useState<string | undefined>();
  const [settlementSaving, setSettlementSaving] = useState(false);
  const settlementSavingRef = useRef(false);
  const settlementDelivery = deliveries.find(({ id }) => id === settlementDeliveryId);
  const resolveStableDeliveryItems = useMemo(
    () => createStableListReferenceResolver<Delivery>(),
    [],
  );
  const stableDeliveryItems = useMemo(
    () => resolveStableDeliveryItems(deliveries),
    [deliveries, resolveStableDeliveryItems],
  );
  const historySessionScopeKey = `${user?.id ?? 'signed-out'}:${sessionVersion}`;
  const projectHistoryDeliveries = useMemo(
    () => createHistoryDeliveryProjector(toHistoryDelivery, historySessionScopeKey),
    [historySessionScopeKey],
  );
  const allDeliveries = useMemo(() => {
    return projectHistoryDeliveries(stableDeliveryItems, historySessionScopeKey).items;
  }, [historySessionScopeKey, projectHistoryDeliveries, stableDeliveryItems]);
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

  const handleOpenStatusSheet = useCallback(
    (deliveryId: string) => {
      if (testModeEnabled) return;
      triggerSelectionHaptic();
      const delivery = deliveries.find((item) => item.id === deliveryId);
      if (!delivery) return;
      setSettlementDeliveryId(deliveryId);
      setSettlementDelivered(delivery.entregue);
      setSettlementPaymentSelection(getPaymentSelection(delivery));
      setSettlementPaymentSelectionChanged(false);
      setSettlementError(undefined);
    },
    [deliveries, testModeEnabled],
  );

  const handleMarkDelivered = useCallback(
    (deliveryId: string) => {
      if (testModeEnabled) return;
      triggerSelectionHaptic();
      void setDelivered(deliveryId, true);
    },
    [setDelivered, testModeEnabled],
  );

  const handleCloseSettlement = useCallback(() => {
    if (settlementSavingRef.current) return;
    setSettlementDeliveryId(null);
    setSettlementPaymentSelection('Não Pago');
    setSettlementPaymentSelectionChanged(false);
    setSettlementError(undefined);
  }, []);

  const handlePaymentSelectionChange = useCallback((selection: DeliveryPaymentSelection) => {
    setSettlementPaymentSelection(selection);
    setSettlementPaymentSelectionChanged(true);
  }, []);

  const handleConfirmSettlement = useCallback(
    async (paymentReversalConfirmed: boolean) => {
      if (!settlementDelivery || settlementSavingRef.current) return;
      settlementSavingRef.current = true;
      setSettlementSaving(true);
      setSettlementError(undefined);
      try {
        await updateHistoryWorkflow(settlementDelivery.id, {
          delivered: settlementDelivered,
          expected: {
            dataPagamento: settlementDelivery.dataPagamento,
            entregue: settlementDelivery.entregue,
            metodoPagamento: settlementDelivery.metodoPagamento,
            status: settlementDelivery.status,
          },
          paymentReversalConfirmed,
          paymentSelection: settlementPaymentSelection,
          paymentSelectionChanged:
            settlementPaymentSelectionChanged ||
            (settlementDelivery.status === 'Pago' &&
              !hasKnownPaymentMethod(settlementDelivery) &&
              settlementDelivered === settlementDelivery.entregue),
        });
        setSettlementDeliveryId(null);
        setSettlementPaymentSelection('Não Pago');
        setSettlementPaymentSelectionChanged(false);
      } catch (error) {
        setSettlementError(
          error instanceof Error ? error.message : 'Não foi possível salvar os estados da entrega.',
        );
      } finally {
        settlementSavingRef.current = false;
        setSettlementSaving(false);
      }
    },
    [
      settlementDelivery,
      settlementDelivered,
      settlementPaymentSelection,
      settlementPaymentSelectionChanged,
      updateHistoryWorkflow,
    ],
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
          key={selectedDate}
          entering={FadeIn.duration(reduceMotionEnabled ? 0 : 150)}
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
              <View key={delivery.id} style={styles.fullWidth}>
                <DeliveryCard
                  contained
                  delivery={delivery}
                  onDelete={() => handleDeleteDelivery(delivery.id)}
                  onMarkDelivered={() => handleMarkDelivered(delivery.id)}
                  onOpenStatusSheet={() => handleOpenStatusSheet(delivery.id)}
                />
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <GlassCard
                style={[styles.emptyCard, { borderRadius: theme.radius.xl + theme.spacing.md }]}
              >
                <EmptyState />
              </GlassCard>
            </View>
          )}
        </Animated.View>
      </>
    );
  }, [
    handleDeleteDelivery,
    handleMarkDelivered,
    handleOpenStatusSheet,
    reduceMotionEnabled,
    selectedDate,
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
      <HistoryPaymentSheet
        amount={settlementDelivery ? maskText(formatCurrency(settlementDelivery.valor)) : ''}
        clientName={settlementDelivery?.cliente ?? ''}
        delivered={settlementDelivered}
        error={settlementError}
        isPaid={settlementDelivery?.status === 'Pago'}
        paymentSelection={settlementPaymentSelection}
        saving={settlementSaving}
        visible={settlementDeliveryId !== null}
        onCancel={handleCloseSettlement}
        onConfirm={(paymentReversalConfirmed) =>
          void handleConfirmSettlement(paymentReversalConfirmed)
        }
        onDeliveredChange={setSettlementDelivered}
        onPaymentSelectionChange={handlePaymentSelectionChange}
      />
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
