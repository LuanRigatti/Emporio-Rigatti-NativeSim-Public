import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlatList, View } from 'react-native';

import { DeliveryCard, EmptyState, LargeTitleHeader, Screen } from '@/components';
import { useClients } from '@/hooks/useClients';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useFinancialPrivacy } from '@/hooks/useFinancialPrivacy';
import { formatCurrency, normalizeClientKey } from '@/utils/data';
import type { ClientsStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<ClientsStackParamList, 'ClientDeliveries'>;

export function ClientDeliveries({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const { hidden } = useFinancialPrivacy();
  const { loading } = useClients();
  const { deliveries: loadedDeliveries } = useDeliveries({
    mode: 'all',
    clientId: route.params.clientId,
  });
  const deliveries = loadedDeliveries.filter(
    (delivery) =>
      normalizeClientKey(delivery.cliente) === normalizeClientKey(route.params.clientName),
  );

  return (
    <Screen>
      <LargeTitleHeader
        onBack={() => navigation.goBack()}
        subtitle="Histórico preservado no array atual"
        title="Entregas"
      />
      {loading ? null : deliveries.length === 0 ? (
        <EmptyState
          description="Este cliente ainda não possui entregas relacionadas."
          title="Nenhuma entrega"
        />
      ) : (
        <FlatList
          contentContainerStyle={{ gap: theme.spacing.sm, padding: theme.spacing.md }}
          data={deliveries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <DeliveryCard
              clientName={item.cliente}
              dateLabel={item.data}
              delivered={item.entregue}
              quantityLabel={`${item.quantidade} balde(s)`}
              status={item.status === 'Pago' ? 'Pago' : 'Não Pago'}
              totalLabel={hidden ? '••••' : formatCurrency(item.valor)}
            />
          )}
        />
      )}
      <View />
    </Screen>
  );
}
