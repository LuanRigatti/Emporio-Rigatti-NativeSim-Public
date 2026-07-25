import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { View } from 'react-native';

import {
  DeliveryCard,
  EmptyState,
  ErrorState,
  FinanceCard,
  IconButton,
  LargeTitleHeader,
  ListItem,
  PaymentCard,
  ScrollScreen,
  Section,
  SectionHeader,
  Skeleton,
} from '@/components';
import { useFinancialDashboard } from '@/hooks/useFinancialDashboard';
import { useFinancialPrivacy } from '@/hooks/useFinancialPrivacy';
import type { DashboardStackParamList, FinanceMetric, MainTabParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';
import { formatCurrency } from '@/utils/data';

type Props = NativeStackScreenProps<DashboardStackParamList, 'HomeDashboard'>;

export function DashboardScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const { hidden, toggleHidden } = useFinancialPrivacy();
  const dashboard = useFinancialDashboard();
  const tabs = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  const recentDeliveries = dashboard.recentDeliveries ?? [];
  const pendingPayments = dashboard.pendingPayments ?? [];
  const incompleteToday = dashboard.incompleteToday ?? [];

  const openMetric = (metric: FinanceMetric, period: 'day' | 'month') => {
    navigation.navigate('DashboardIndicatorDetails', { metric, period });
  };

  return (
    <ScrollScreen onRefresh={() => void dashboard.reload()} refreshing={dashboard.refreshing}>
      <LargeTitleHeader
        rightAction={
          <IconButton
            accessibilityLabel={hidden ? 'Mostrar valores' : 'Ocultar valores'}
            icon={
              <Ionicons
                color={theme.colors.primary}
                name={hidden ? 'eye-off-outline' : 'eye-outline'}
                size={theme.sizes.iconMedium}
              />
            }
            onPress={toggleHidden}
          />
        }
        subtitle="Visão geral das entregas e resultados"
        title="Início"
      />
      <View style={{ gap: theme.spacing.lg, padding: theme.spacing.md }}>
        {dashboard.loading ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Skeleton height={theme.sizes.loadingLineHeight * 4} />
            <Skeleton height={theme.sizes.loadingLineHeight * 4} />
            <Skeleton height={theme.sizes.loadingLineHeight * 4} />
          </View>
        ) : dashboard.error ? (
          <ErrorState
            description={dashboard.error}
            onRetry={() => void dashboard.reload()}
            title="Não foi possível carregar o dashboard"
          />
        ) : dashboard.daySummary && dashboard.monthSummary ? (
          <>
            <Section title="Resumo do dia">
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <FinanceCard
                  label="Faturamento"
                  onPress={() => openMetric('faturamento', 'day')}
                  style={{ flex: 1 }}
                  value={hidden ? '••••' : formatCurrency(dashboard.daySummary.faturamento)}
                />
                <FinanceCard
                  label="Entregas"
                  onPress={() => openMetric('quantidade', 'day')}
                  style={{ flex: 1 }}
                  value={hidden ? '••••' : `${dashboard.daySummary.quantidadeEntregas}`}
                />
              </View>
            </Section>
            <Section>
              <SectionHeader
                actionLabel="Ver financeiro"
                onActionPress={() => tabs?.navigate('Financeiro', { screen: 'FinanceHome' })}
                title="Resumo do mês"
              />
              <FinanceCard
                label="Faturamento"
                onPress={() => openMetric('faturamento', 'month')}
                value={hidden ? '••••' : formatCurrency(dashboard.monthSummary.faturamento)}
              />
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <FinanceCard
                  label="Recebido"
                  onPress={() => openMetric('pago', 'month')}
                  style={{ flex: 1 }}
                  value={hidden ? '••••' : formatCurrency(dashboard.monthSummary.valoresPagos)}
                />
                <FinanceCard
                  label="Lucro líquido"
                  onPress={() => openMetric('lucroLiquido', 'month')}
                  style={{ flex: 1 }}
                  value={hidden ? '••••' : formatCurrency(dashboard.monthSummary.lucroLiquido)}
                />
              </View>
            </Section>
            <Section title="Atalhos rápidos">
              <ListItem
                leading={
                  <Ionicons
                    color={theme.colors.primary}
                    name="add-circle-outline"
                    size={theme.sizes.iconMedium}
                  />
                }
                onPress={() =>
                  tabs?.navigate('Entregas', {
                    screen: 'NewDelivery',
                    params: { date: dashboard.date },
                  })
                }
                title="Nova entrega"
              />
              <ListItem
                leading={
                  <Ionicons
                    color={theme.colors.primary}
                    name="car-outline"
                    size={theme.sizes.iconMedium}
                  />
                }
                onPress={() =>
                  tabs?.navigate('Entregas', {
                    screen: 'DeliveriesHome',
                    params: { mode: 'today', date: dashboard.date },
                  })
                }
                title="Entregas do dia"
              />
              <ListItem
                leading={
                  <Ionicons
                    color={theme.colors.primary}
                    name="business-outline"
                    size={theme.sizes.iconMedium}
                  />
                }
                onPress={() => tabs?.navigate('Financeiro', { screen: 'FinanceFactory' })}
                title="Acompanhar fábrica"
              />
            </Section>
            <Section>
              <SectionHeader
                actionLabel="Ver todas"
                onActionPress={() =>
                  navigation.navigate('DashboardDeliveryRecords', {
                    mode: 'recent',
                    period: 'month',
                  })
                }
                title="Entregas recentes"
              />
              {recentDeliveries.length ? (
                recentDeliveries.map((delivery) => (
                  <DeliveryCard
                    key={delivery.id}
                    clientName={delivery.cliente}
                    dateLabel={delivery.data}
                    delivered={delivery.entregue}
                    hiddenValue={hidden}
                    onPress={() =>
                      tabs?.navigate('Entregas', {
                        screen: 'DeliveryDetails',
                        params: { deliveryId: delivery.id },
                      })
                    }
                    quantityLabel={`${delivery.quantidade} balde(s)`}
                    status={delivery.status === 'Pago' ? 'Pago' : 'Não Pago'}
                    totalLabel={hidden ? '••••' : formatCurrency(delivery.valor)}
                  />
                ))
              ) : (
                <EmptyState
                  description="As entregas mais recentes aparecerão aqui."
                  title="Nenhuma entrega recente"
                />
              )}
            </Section>
            <Section>
              <SectionHeader
                actionLabel="Ver pendências"
                onActionPress={() =>
                  navigation.navigate('DashboardDeliveryRecords', {
                    mode: 'pending',
                    period: 'month',
                  })
                }
                title="Pagamentos pendentes"
              />
              {pendingPayments.length ? (
                pendingPayments.slice(0, 3).map((delivery) => (
                  <PaymentCard
                    key={delivery.id}
                    amountLabel={hidden ? '••••' : formatCurrency(delivery.valor)}
                    clientName={delivery.cliente}
                    dateLabel={delivery.data}
                    hiddenValue={hidden}
                    onPress={() =>
                      tabs?.navigate('Entregas', {
                        screen: 'DeliveryDetails',
                        params: { deliveryId: delivery.id },
                      })
                    }
                    onSettle={() =>
                      tabs?.navigate('Entregas', {
                        screen: 'DeliverySettlement',
                        params: { deliveryIds: [delivery.id] },
                      })
                    }
                    status="Não Pago"
                  />
                ))
              ) : (
                <EmptyState
                  description="Não há pagamentos pendentes de entregas realizadas neste mês."
                  title="Tudo em dia"
                />
              )}
            </Section>
            <Section title="Alertas">
              {incompleteToday.length ? (
                incompleteToday.map((delivery) => (
                  <ListItem
                    key={delivery.id}
                    leading={
                      <Ionicons
                        color={theme.colors.warning}
                        name="alert-circle-outline"
                        size={theme.sizes.iconMedium}
                      />
                    }
                    onPress={() =>
                      tabs?.navigate('Entregas', {
                        screen: 'DeliveryDetails',
                        params: { deliveryId: delivery.id },
                      })
                    }
                    subtitle={delivery.data}
                    title={`${delivery.cliente} ainda não foi marcada como entregue`}
                  />
                ))
              ) : (
                <ListItem
                  leading={
                    <Ionicons
                      color={theme.colors.success}
                      name="checkmark-circle-outline"
                      size={theme.sizes.iconMedium}
                    />
                  }
                  title="Nenhum alerta operacional para hoje"
                />
              )}
            </Section>
            <Section title="Fábrica">
              <FinanceCard
                label="Valor em aberto"
                onPress={() => tabs?.navigate('Financeiro', { screen: 'FinanceFactory' })}
                value={hidden ? '••••' : formatCurrency(dashboard.factorySummary?.openValue ?? 0)}
              />
            </Section>
          </>
        ) : null}
      </View>
    </ScrollScreen>
  );
}
