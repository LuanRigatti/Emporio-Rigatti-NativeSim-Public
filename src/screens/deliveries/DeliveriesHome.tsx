import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import {
  BottomSheet,
  ConfirmationDialog,
  DeliveryCard,
  EmptyState,
  ErrorState,
  FilterBar,
  IconButton,
  LargeTitleHeader,
  PrimaryButton,
  SearchBar,
  SecondaryButton,
  SegmentedControl,
  Skeleton,
  SwipeAction,
  SwipeableListItem,
  TextButton,
} from '@/components';
import { Screen } from '@/components/layout';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useFinancialPrivacy } from '@/hooks/useFinancialPrivacy';
import type { DeliveriesStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';
import { formatOperationalDate, formatPtBrDate, todayIso } from '@/utils/data';

type Props = NativeStackScreenProps<DeliveriesStackParamList, 'DeliveriesHome'>;
type PaymentStatus = 'Todos' | 'Pago' | 'Não Pago';
type DeliveryStatusFilter = 'Todos' | 'Entregue' | 'Não entregue';
type InvoiceStatusFilter = 'Todos' | 'emitido' | 'a_emitir';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { currency: 'BRL', style: 'currency' }).format(value);
}

function DeliveryLoadingState() {
  const { theme } = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.lg }}>
      <Skeleton height={theme.sizes.loadingLineHeight * 3} />
      <Skeleton height={theme.sizes.loadingLineHeight * 3} />
      <Skeleton height={theme.sizes.loadingLineHeight * 3} />
    </View>
  );
}

export function DeliveriesHome({ navigation }: Props) {
  const { theme } = useAppTheme();
  const { hidden } = useFinancialPrivacy();
  const operationalDate = todayIso();
  const [status, setStatus] = useState<PaymentStatus>('Todos');
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatusFilter>('Todos');
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatusFilter>('Todos');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [draftStatus, setDraftStatus] = useState<PaymentStatus>('Todos');
  const [draftDeliveryStatus, setDraftDeliveryStatus] = useState<DeliveryStatusFilter>('Todos');
  const [draftInvoiceStatus, setDraftInvoiceStatus] = useState<InvoiceStatusFilter>('Todos');
  const [search, setSearch] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | undefined>();
  const [actionError, setActionError] = useState<string | undefined>();
  const { deliveries, loading, refreshing, error, reload, remove } = useDeliveries({
    mode: 'today',
    date: operationalDate,
    search,
    status,
    deliveryStatus,
    invoiceStatus,
  });

  const filters = useMemo(
    () => [
      ...(status !== 'Todos' ? [{ key: 'status', label: status }] : []),
      ...(deliveryStatus !== 'Todos' ? [{ key: 'deliveryStatus', label: deliveryStatus }] : []),
      ...(invoiceStatus !== 'Todos'
        ? [
            {
              key: 'invoiceStatus',
              label: invoiceStatus === 'emitido' ? 'Nota emitida' : 'Nota a emitir',
            },
          ]
        : []),
    ],
    [deliveryStatus, invoiceStatus, status],
  );

  const hasActiveFilters = filters.length > 0;
  const showListControls = loading || deliveries.length > 0 || Boolean(search) || hasActiveFilters;

  const openFilters = () => {
    setDraftStatus(status);
    setDraftDeliveryStatus(deliveryStatus);
    setDraftInvoiceStatus(invoiceStatus);
    setFiltersVisible(true);
  };

  const applyFilters = () => {
    setStatus(draftStatus);
    setDeliveryStatus(draftDeliveryStatus);
    setInvoiceStatus(draftInvoiceStatus);
    setFiltersVisible(false);
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const clearFilters = () => {
    setStatus('Todos');
    setDeliveryStatus('Todos');
    setInvoiceStatus('Todos');
    setSearch('');
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const toggleSelection = (deliveryId: string) => {
    setSelectedIds((current) =>
      current.includes(deliveryId)
        ? current.filter((id) => id !== deliveryId)
        : [...current, deliveryId],
    );
  };

  const deleteDelivery = async () => {
    if (!deleteId) return;
    try {
      await remove(deleteId);
      setDeleteId(undefined);
    } catch (removeError) {
      setActionError(
        removeError instanceof Error ? removeError.message : 'Não foi possível excluir.',
      );
    }
  };

  return (
    <Screen>
      <LargeTitleHeader
        leftAction={
          <IconButton
            accessibilityLabel="Preparar rota do dia"
            icon={
              <Ionicons
                color={theme.colors.primary}
                name="map-outline"
                size={theme.sizes.iconMedium}
              />
            }
            onPress={() => navigation.navigate('RouteDay', { date: operationalDate })}
          />
        }
        rightAction={
          <IconButton
            accessibilityLabel="Nova entrega"
            icon={
              <Ionicons color={theme.colors.primary} name="add" size={theme.sizes.iconMedium} />
            }
            onPress={() => navigation.navigate('NewDelivery', { date: operationalDate })}
          />
        }
        subtitle={
          selectionMode
            ? `${selectedIds.length} selecionada(s)`
            : formatOperationalDate(operationalDate)
        }
        title="Entregas"
      />
      <View style={{ flex: 1, paddingHorizontal: theme.spacing.md }}>
        {showListControls ? (
          <>
            <SearchBar
              clearable
              onChangeText={setSearch}
              onClear={() => setSearch('')}
              placeholder="Buscar cliente nas entregas de hoje"
              style={{ marginTop: theme.spacing.sm }}
              value={search}
            />
            <FilterBar
              filters={filters}
              onPress={openFilters}
              onRemove={(key) => {
                if (key === 'status') setStatus('Todos');
                if (key === 'deliveryStatus') setDeliveryStatus('Todos');
                if (key === 'invoiceStatus') setInvoiceStatus('Todos');
              }}
              style={{ marginTop: theme.spacing.xs }}
            />
            {hasActiveFilters || search ? (
              <View style={{ alignItems: 'flex-end', minHeight: theme.sizes.touchTargetMinimum }}>
                <TextButton onPress={clearFilters}>Limpar filtros</TextButton>
              </View>
            ) : null}
          </>
        ) : null}
        {loading ? (
          <DeliveryLoadingState />
        ) : error ? (
          <ErrorState
            description={error}
            onRetry={() => void reload()}
            title="Não foi possível carregar entregas"
          />
        ) : deliveries.length === 0 ? (
          <EmptyState
            description={
              hasActiveFilters || search
                ? 'Nenhuma entrega corresponde aos filtros selecionados.'
                : `Nenhuma entrega está prevista para ${formatOperationalDate(operationalDate)}.`
            }
            title="Nenhuma entrega encontrada"
            actionLabel={hasActiveFilters || search ? 'Limpar filtros' : 'Nova entrega'}
            onActionPress={() => {
              if (hasActiveFilters || search) clearFilters();
              else navigation.navigate('NewDelivery', { date: operationalDate });
            }}
          />
        ) : (
          <FlatList
            contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.lg }}
            data={deliveries}
            keyExtractor={(item) => item.id}
            onRefresh={() => void reload()}
            refreshing={refreshing}
            renderItem={({ item }) => {
              const selected = selectedIds.includes(item.id);
              return (
                <SwipeableListItem
                  rightActions={
                    <SwipeAction
                      icon={
                        <Ionicons
                          color={theme.colors.textInverse}
                          name="trash-outline"
                          size={theme.sizes.iconSmall}
                        />
                      }
                      label="Excluir"
                      onPress={() => setDeleteId(item.id)}
                      tone="danger"
                    />
                  }
                  onSwipe={(direction) => {
                    if (direction === 'left') setDeleteId(item.id);
                  }}
                >
                  <DeliveryCard
                    clientName={item.cliente}
                    dateLabel={formatPtBrDate(item.data)}
                    delivered={item.entregue}
                    onPress={() => {
                      if (selectionMode) toggleSelection(item.id);
                      else navigation.navigate('DeliveryDetails', { deliveryId: item.id });
                    }}
                    onPrimaryAction={() =>
                      navigation.navigate('DeliveryDetails', { deliveryId: item.id })
                    }
                    quantityLabel={`${item.quantidade} balde(s)${selected ? ' • selecionada' : ''}`}
                    status={item.status === 'Pago' ? 'Pago' : 'Não Pago'}
                    totalLabel={hidden ? '••••' : formatCurrency(item.valor)}
                  />
                </SwipeableListItem>
              );
            }}
            showsVerticalScrollIndicator={false}
          />
        )}
        {deliveries.length > 0 ? (
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
        ) : null}
        {selectionMode && selectedIds.length > 0 ? (
          <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
            <SecondaryButton
              fullWidth
              onPress={() => navigation.navigate('DeliveryBulkEdit', { deliveryIds: selectedIds })}
            >
              Editar selecionadas
            </SecondaryButton>
            <PrimaryButton
              fullWidth
              onPress={() =>
                navigation.navigate('DeliverySettlement', { deliveryIds: selectedIds })
              }
            >
              Quitar selecionadas
            </PrimaryButton>
          </View>
        ) : null}
      </View>
      <ConfirmationDialog
        confirmLabel="Excluir entrega"
        destructive
        message="A entrega será removida do array atual. Essa ação não pode ser desfeita automaticamente."
        onCancel={() => setDeleteId(undefined)}
        onConfirm={() => void deleteDelivery()}
        title="Excluir entrega?"
        visible={Boolean(deleteId)}
      />
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
            <SecondaryButton fullWidth onPress={() => setFiltersVisible(false)}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton fullWidth onPress={applyFilters}>
              Aplicar filtros
            </PrimaryButton>
          </View>
        }
        onClose={() => setFiltersVisible(false)}
        title="Filtrar entregas de hoje"
        visible={filtersVisible}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <Text style={[theme.typography.subheadline, { color: theme.colors.textPrimary }]}>
            Pagamento
          </Text>
          <SegmentedControl
            options={[
              { value: 'Todos' as const, label: 'Todos' },
              { value: 'Pago' as const, label: 'Pago' },
              { value: 'Não Pago' as const, label: 'Não Pago' },
            ]}
            value={draftStatus}
            onChange={setDraftStatus}
          />
        </View>
        <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.md }}>
          <Text style={[theme.typography.subheadline, { color: theme.colors.textPrimary }]}>
            Entrega
          </Text>
          <SegmentedControl
            options={[
              { value: 'Todos' as const, label: 'Todos' },
              { value: 'Entregue' as const, label: 'Entregue' },
              { value: 'Não entregue' as const, label: 'Não entregue' },
            ]}
            value={draftDeliveryStatus}
            onChange={setDraftDeliveryStatus}
          />
        </View>
        <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.md }}>
          <Text style={[theme.typography.subheadline, { color: theme.colors.textPrimary }]}>
            Nota fiscal
          </Text>
          <SegmentedControl
            options={[
              { value: 'Todos' as const, label: 'Todos' },
              { value: 'emitido' as const, label: 'Nota emitida' },
              { value: 'a_emitir' as const, label: 'Nota a emitir' },
            ]}
            value={draftInvoiceStatus}
            onChange={setDraftInvoiceStatus}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}
