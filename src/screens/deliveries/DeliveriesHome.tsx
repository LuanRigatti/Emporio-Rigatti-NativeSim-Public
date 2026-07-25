import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import {
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

type Props = NativeStackScreenProps<DeliveriesStackParamList, 'DeliveriesHome'>;
type Mode = 'today' | 'all';
type PaymentStatus = 'Todos' | 'Pago' | 'Não Pago';

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

export function DeliveriesHome({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const { hidden } = useFinancialPrivacy();
  const [mode, setMode] = useState<Mode>(route.params?.mode ?? 'today');
  const [status, setStatus] = useState<PaymentStatus>(route.params?.status ?? 'Todos');
  const [search, setSearch] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | undefined>();
  const [actionError, setActionError] = useState<string | undefined>();
  const { deliveries, loading, refreshing, error, reload, remove } = useDeliveries({
    mode,
    date: route.params?.date,
    search,
    clientName: route.params?.clientName,
    status,
  });

  const filters = useMemo(
    () => [
      { key: 'mode', label: mode === 'today' ? 'Hoje' : 'Todas' },
      ...(status !== 'Todos' ? [{ key: 'status', label: status }] : []),
    ],
    [mode, status],
  );

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
            onPress={() => navigation.navigate('RouteDay', { date: route.params?.date })}
          />
        }
        rightAction={
          <IconButton
            accessibilityLabel="Nova entrega"
            icon={
              <Ionicons color={theme.colors.primary} name="add" size={theme.sizes.iconMedium} />
            }
            onPress={() => navigation.navigate('NewDelivery', { date: route.params?.date })}
          />
        }
        subtitle={
          selectionMode ? `${selectedIds.length} selecionada(s)` : 'Entregas do dia e histórico'
        }
        title="Entregas"
      />
      <View style={{ flex: 1, paddingHorizontal: theme.spacing.md }}>
        <SegmentedControl
          options={[
            { value: 'today' as const, label: 'Hoje' },
            { value: 'all' as const, label: 'Todas' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <SearchBar
          clearable
          onChangeText={setSearch}
          onClear={() => setSearch('')}
          placeholder="Buscar cliente"
          style={{ marginTop: theme.spacing.sm }}
          value={search}
        />
        <FilterBar
          filters={filters}
          onPress={() => setStatus(status === 'Todos' ? 'Não Pago' : 'Todos')}
          onRemove={(key) => {
            if (key === 'status') setStatus('Todos');
            if (key === 'mode') setMode('today');
          }}
          style={{ marginTop: theme.spacing.xs }}
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
              mode === 'today'
                ? 'Nenhuma entrega está prevista para hoje.'
                : 'Cadastre uma entrega para começar.'
            }
            title="Nenhuma entrega encontrada"
            actionLabel="Nova entrega"
            onActionPress={() => navigation.navigate('NewDelivery')}
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
                    dateLabel={item.data}
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
    </Screen>
  );
}
