import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Platform, SectionList, Text, View } from 'react-native';

import {
  BottomSheet,
  ConfirmationDialog,
  DeliveryCard,
  EmptyState,
  ErrorState,
  FilterBar,
  IconButton,
  Input,
  LargeTitleHeader,
  PrimaryButton,
  SearchBar,
  Section,
  SectionHeader,
  SecondaryButton,
  SegmentedControl,
  Skeleton,
  SwipeAction,
  SwipeableListItem,
  TextButton,
} from '@/components';
import { useHistory } from '@/hooks/useHistory';
import { useFinancialPrivacy } from '@/hooks/useFinancialPrivacy';
import type {
  HistoryDayGroup,
  HistoryMonthGroup,
  HistoryFilters,
  HistoryPeriod,
} from '@/types/data';
import type { MainTabParamList, MoreStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';
import { formatCurrency } from '@/utils/data';

type Props = NativeStackScreenProps<MoreStackParamList, 'History'>;

function todayIso(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1, 12);
}

function formatMonth(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    parseDate(`${value}-01`),
  );
}

function formatDay(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  }).format(parseDate(value));
}

function summaryText(day: HistoryDayGroup, hidden: boolean): string {
  return `${day.summary.quantity} balde(s) · ${day.summary.deliveryCount} entrega(s) · média combustível ${hidden ? '••••' : formatCurrency(day.summary.fuelCostPerDelivery)}`;
}

function filterLabel(filters: HistoryFilters): string {
  if (filters.period === 'year') return `Ano ${filters.year ?? 'selecionado'}`;
  if (filters.period === 'day') return filters.day ?? 'Dia';
  if (filters.period === 'all')
    return filters.year && filters.year !== 'todos' ? `Ano ${filters.year}` : 'Todos';
  if (filters.period === 'week') return 'Semana';
  if (filters.period === 'range') return 'Intervalo';
  return filters.month ?? 'Mês';
}

export function HistoryScreen({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const { hidden } = useFinancialPrivacy();
  const initialFilters = route.params ?? {
    period: 'month' as const,
    month: todayIso().slice(0, 7),
    year: todayIso().slice(0, 4),
    status: 'Todos' as const,
  };
  const history = useHistory(initialFilters);
  const tabs = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [draftFilters, setDraftFilters] = useState<HistoryFilters>(history.filters);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | undefined>();
  const [actionError, setActionError] = useState<string | undefined>();
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const filterOptions = useMemo(
    () => [
      { key: 'period', label: filterLabel(history.filters) },
      ...(history.filters.year &&
      history.filters.year !== 'todos' &&
      history.filters.period !== 'month'
        ? [{ key: 'year', label: history.filters.year }]
        : []),
      ...(history.filters.month && history.filters.period === 'month'
        ? [{ key: 'month', label: history.filters.month }]
        : []),
      ...(history.filters.day ? [{ key: 'day', label: history.filters.day }] : []),
      ...(history.filters.status && history.filters.status !== 'Todos'
        ? [{ key: 'status', label: history.filters.status }]
        : []),
    ],
    [history.filters],
  );

  const sections = useMemo(
    () =>
      history.monthGroups.map((month) => ({
        ...month,
        data: expandedMonths.has(month.key) ? month.days : [],
      })),
    [expandedMonths, history.monthGroups],
  );

  const toggleMonth = (month: HistoryMonthGroup) => {
    setExpandedMonths((current) => {
      const next = new Set(current);
      if (next.has(month.key)) next.delete(month.key);
      else next.add(month.key);
      return next;
    });
  };

  const toggleDay = (day: HistoryDayGroup) => {
    setExpandedDays((current) => {
      const next = new Set(current);
      if (next.has(day.key)) next.delete(day.key);
      else next.add(day.key);
      return next;
    });
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const openFilters = () => {
    setDraftFilters(history.filters);
    setSheetVisible(true);
  };

  const applyFilters = () => {
    const next: HistoryFilters = {
      ...draftFilters,
      status: draftFilters.status ?? 'Todos',
    };
    if (next.period === 'year' && !next.year) next.year = String(new Date().getFullYear());
    if (next.period === 'month' && !next.month) next.month = todayIso().slice(0, 7);
    if (next.period === 'day' && !next.day) next.day = todayIso();
    history.setFilters(next);
    setExpandedMonths(new Set());
    setExpandedDays(new Set());
    setSheetVisible(false);
  };

  const clearFilter = (key: string) => {
    if (key === 'period' || key === 'month') {
      history.setFilters({ period: 'month', month: todayIso().slice(0, 7), status: 'Todos' });
    } else if (key === 'year') {
      history.setFilters({ ...history.filters, year: 'todos' });
    } else if (key === 'day') {
      history.setFilters({ ...history.filters, day: undefined });
    } else if (key === 'status') {
      history.setFilters({ ...history.filters, status: 'Todos' });
    }
  };

  const onDateChange = (event: DateTimePickerEvent, date?: Date) => {
    setDatePickerVisible(false);
    if (event.type !== 'dismissed' && date) {
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate(),
      ).padStart(2, '0')}`;
      setDraftFilters((current) => ({ ...current, day: value }));
    }
  };

  const editDelivery = (deliveryId: string) => {
    tabs?.navigate('Entregas', { screen: 'EditDelivery', params: { deliveryId } });
  };

  const openDetails = (deliveryId: string) => {
    if (selectionMode) toggleSelection(deliveryId);
    else tabs?.navigate('Entregas', { screen: 'DeliveryDetails', params: { deliveryId } });
  };

  const deleteDelivery = async () => {
    if (!deleteId) return;
    try {
      setActionError(undefined);
      await history.remove(deleteId);
      setDeleteId(undefined);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Não foi possível excluir a entrega.',
      );
    }
  };

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <LargeTitleHeader
        rightAction={
          <View style={{ flexDirection: 'row' }}>
            <IconButton
              accessibilityLabel="Abrir ranking do histórico"
              icon={
                <Ionicons
                  color={theme.colors.primary}
                  name="podium-outline"
                  size={theme.sizes.iconMedium}
                />
              }
              onPress={() => navigation.navigate('HistoryRanking', history.filters)}
            />
            <IconButton
              accessibilityLabel="Abrir filtros do histórico"
              icon={
                <Ionicons
                  color={theme.colors.primary}
                  name="filter-outline"
                  size={theme.sizes.iconMedium}
                />
              }
              onPress={openFilters}
            />
          </View>
        }
        subtitle={
          selectionMode ? `${selectedIds.length} selecionada(s)` : 'Entregas agrupadas por período'
        }
        title="Histórico"
      />
      <View style={{ paddingHorizontal: theme.spacing.md }}>
        <SearchBar
          clearable
          onChangeText={(search) => history.setFilters({ ...history.filters, search })}
          onClear={() => history.setFilters({ ...history.filters, search: undefined })}
          placeholder="Buscar cliente"
          value={history.filters.search ?? ''}
        />
        <FilterBar
          filters={filterOptions}
          onPress={openFilters}
          onRemove={clearFilter}
          style={{ marginTop: theme.spacing.sm }}
        />
        <View style={{ alignItems: 'flex-end', minHeight: theme.sizes.touchTargetMinimum }}>
          <TextButton
            onPress={() => {
              setSelectionMode((current) => !current);
              setSelectedIds([]);
            }}
          >
            {selectionMode ? 'Cancelar seleção' : 'Selecionar várias'}
          </TextButton>
        </View>
      </View>
      {history.loading ? (
        <View style={{ gap: theme.spacing.sm, padding: theme.spacing.md }}>
          <Skeleton height={theme.sizes.loadingLineHeight * 4} />
          <Skeleton height={theme.sizes.loadingLineHeight * 4} />
        </View>
      ) : history.error ? (
        <ErrorState
          description={history.error}
          onRetry={() => void history.reload()}
          title="Não foi possível carregar o histórico"
        />
      ) : history.filteredDeliveries.length === 0 ? (
        <EmptyState
          description="Tente alterar os filtros ou a busca por cliente."
          title="Nenhuma entrega encontrada"
        />
      ) : (
        <SectionList<HistoryDayGroup, HistoryMonthGroup>
          contentContainerStyle={{ gap: theme.spacing.xs, padding: theme.spacing.md }}
          keyExtractor={(item) => item.key}
          onRefresh={() => void history.reload()}
          refreshing={history.refreshing}
          renderItem={({ item }) => (
            <Section>
              <SectionHeader
                actionLabel={expandedDays.has(item.key) ? 'Recolher' : 'Expandir'}
                description={summaryText(item, hidden)}
                onActionPress={() => toggleDay(item)}
                title={formatDay(item.date)}
              />
              {expandedDays.has(item.key)
                ? item.deliveries.map((delivery) => (
                    <SwipeableListItem
                      key={delivery.id}
                      rightActions={
                        <View style={{ flexDirection: 'row' }}>
                          <SwipeAction label="Editar" onPress={() => editDelivery(delivery.id)} />
                          <SwipeAction
                            icon={
                              <Ionicons
                                color={theme.colors.textInverse}
                                name="trash-outline"
                                size={theme.sizes.iconSmall}
                              />
                            }
                            label="Excluir"
                            onPress={() => setDeleteId(delivery.id)}
                            tone="danger"
                          />
                        </View>
                      }
                      onSwipe={(direction) => {
                        if (direction === 'left') setDeleteId(delivery.id);
                        if (direction === 'right') editDelivery(delivery.id);
                      }}
                    >
                      <DeliveryCard
                        clientName={delivery.cliente}
                        dateLabel={delivery.data}
                        delivered={delivery.entregue}
                        onPress={() => openDetails(delivery.id)}
                        onPrimaryAction={() => openDetails(delivery.id)}
                        quantityLabel={`${delivery.quantidade} balde(s)${selectedIds.includes(delivery.id) ? ' · selecionada' : ''}`}
                        status={delivery.status === 'Pago' ? 'Pago' : 'Não Pago'}
                        totalLabel={hidden ? '••••' : formatCurrency(delivery.valor)}
                      />
                    </SwipeableListItem>
                  ))
                : null}
            </Section>
          )}
          renderSectionHeader={({ section }) => (
            <View
              style={{
                backgroundColor: theme.colors.background,
                paddingVertical: theme.spacing.xs,
              }}
            >
              <SectionHeader
                actionLabel={expandedMonths.has(section.key) ? 'Recolher mês' : 'Expandir mês'}
                description={`${section.deliveryCount} entrega(s) · ${section.quantity} balde(s)`}
                onActionPress={() => toggleMonth(section)}
                title={formatMonth(section.key)}
              />
            </View>
          )}
          sections={sections}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
        />
      )}
      {selectionMode && selectedIds.length > 0 ? (
        <View style={{ gap: theme.spacing.sm, padding: theme.spacing.md }}>
          <SecondaryButton fullWidth onPress={() => setSelectedIds([])}>
            Limpar seleção
          </SecondaryButton>
          <PrimaryButton
            fullWidth
            onPress={() =>
              tabs?.navigate('Entregas', {
                screen: 'DeliveryBulkEdit',
                params: { deliveryIds: selectedIds },
              })
            }
          >
            Editar selecionadas
          </PrimaryButton>
        </View>
      ) : null}
      {actionError ? (
        <ErrorState
          description={actionError}
          onRetry={() => setActionError(undefined)}
          title="Ação não concluída"
        />
      ) : null}
      <BottomSheet
        footer={
          <View style={{ gap: theme.spacing.sm }}>
            <SecondaryButton fullWidth onPress={() => setSheetVisible(false)}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton fullWidth onPress={applyFilters}>
              Aplicar filtros
            </PrimaryButton>
          </View>
        }
        onClose={() => setSheetVisible(false)}
        title="Filtrar histórico"
        visible={sheetVisible}
      >
        <SegmentedControl
          options={[
            { value: 'month' as const, label: 'Mês' },
            { value: 'year' as const, label: 'Ano' },
            { value: 'day' as const, label: 'Dia' },
            { value: 'week' as const, label: 'Semana' },
            { value: 'all' as const, label: 'Todos' },
          ]}
          value={(draftFilters.period ?? 'month') as HistoryPeriod}
          onChange={(period) => setDraftFilters((current) => ({ ...current, period }))}
        />
        <Input
          keyboardType="number-pad"
          label="Ano"
          onChangeText={(year) =>
            setDraftFilters((current) => ({ ...current, year: year || 'todos' }))
          }
          placeholder={history.availableYears[0] ?? 'Ano'}
          value={draftFilters.year === 'todos' ? '' : (draftFilters.year ?? '')}
          style={{ marginTop: theme.spacing.md }}
        />
        <Input
          keyboardType="numbers-and-punctuation"
          label="Mês (AAAA-MM)"
          onChangeText={(month) => setDraftFilters((current) => ({ ...current, month }))}
          placeholder="2026-07"
          value={draftFilters.month ?? ''}
          style={{ marginTop: theme.spacing.md }}
        />
        <Input
          keyboardType="numbers-and-punctuation"
          label="Dia (AAAA-MM-DD)"
          onChangeText={(day) => setDraftFilters((current) => ({ ...current, day }))}
          placeholder="2026-07-25"
          value={draftFilters.day ?? ''}
          style={{ marginTop: theme.spacing.md }}
        />
        <TextButton
          onPress={() => setDatePickerVisible(true)}
          style={{ marginTop: theme.spacing.xs }}
        >
          Selecionar dia no calendário
        </TextButton>
        {Platform.OS !== 'web' && datePickerVisible ? (
          <DateTimePicker
            value={parseDate(draftFilters.day ?? todayIso())}
            mode="date"
            onChange={onDateChange}
          />
        ) : null}
        <View style={{ marginTop: theme.spacing.lg }}>
          <Text
            style={[
              theme.typography.subheadline,
              { color: theme.colors.textPrimary, marginBottom: theme.spacing.xs },
            ]}
          >
            Status
          </Text>
          <SegmentedControl
            options={[
              { value: 'Todos' as const, label: 'Todos' },
              { value: 'Pago' as const, label: 'Pago' },
              { value: 'Não Pago' as const, label: 'Não Pago' },
            ]}
            value={draftFilters.status ?? 'Todos'}
            onChange={(status) => setDraftFilters((current) => ({ ...current, status }))}
          />
        </View>
      </BottomSheet>
      <ConfirmationDialog
        confirmLabel="Excluir entrega"
        destructive
        message="A entrega será removida do array atual. Essa ação não pode ser desfeita automaticamente."
        onCancel={() => setDeleteId(undefined)}
        onConfirm={() => void deleteDelivery()}
        title="Excluir entrega?"
        visible={Boolean(deleteId)}
      />
    </View>
  );
}
