import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';

import {
  DeliveryCard,
  EmptyState,
  ErrorState,
  LargeTitleHeader,
  PaymentCard,
  ScrollScreen,
  Section,
  Skeleton,
} from '@/components';
import { useFinancialDashboard } from '@/hooks/useFinancialDashboard';
import { useFinancialPrivacy } from '@/hooks/useFinancialPrivacy';
import type { DashboardStackParamList, MainTabParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';
import { formatCurrency } from '@/utils/data';

type Props = NativeStackScreenProps<DashboardStackParamList, 'DashboardDeliveryRecords'>;

export function DashboardDeliveryRecordsScreen({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const { hidden } = useFinancialPrivacy();
  const dashboard = useFinancialDashboard();
  const tabs = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  const records =
    route.params.mode === 'pending'
      ? (dashboard.pendingPayments ?? [])
      : (dashboard.recentDeliveries ?? []);

  return (
    <ScrollScreen onRefresh={() => void dashboard.reload()} refreshing={dashboard.refreshing}>
      <LargeTitleHeader
        onBack={() => navigation.goBack()}
        title={route.params.mode === 'pending' ? 'Pagamentos pendentes' : 'Entregas recentes'}
      />
      <View style={{ padding: theme.spacing.md }}>
        {dashboard.loading ? (
          <Skeleton height={theme.sizes.loadingLineHeight * 8} />
        ) : dashboard.error ? (
          <ErrorState
            description={dashboard.error}
            onRetry={() => void dashboard.reload()}
            title="Não foi possível carregar os registros"
          />
        ) : records.length === 0 ? (
          <EmptyState
            description="Não existem registros para este recorte."
            title="Nenhum registro"
          />
        ) : (
          <Section title={`${records.length} registro(s)`}>
            {records.map((delivery) =>
              route.params.mode === 'pending' ? (
                <PaymentCard
                  key={delivery.id}
                  amountLabel={hidden ? '••••' : formatCurrency(delivery.valor)}
                  clientName={delivery.cliente}
                  dateLabel={delivery.data}
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
              ) : (
                <DeliveryCard
                  key={delivery.id}
                  clientName={delivery.cliente}
                  dateLabel={delivery.data}
                  delivered={delivery.entregue}
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
              ),
            )}
          </Section>
        )}
        <Text
          style={[
            theme.typography.footnote,
            { color: theme.colors.textSecondary, marginTop: theme.spacing.md },
          ]}
        >
          Pendências seguem a regra histórica: status exatamente “Não Pago” e entrega realizada.
        </Text>
      </View>
    </ScrollScreen>
  );
}
