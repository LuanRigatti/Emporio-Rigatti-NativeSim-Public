import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlatList } from 'react-native';

import { EmptyState, LargeTitleHeader, PaymentCard, Screen } from '@/components';
import { useClients } from '@/hooks/useClients';
import { useFinancialPrivacy } from '@/hooks/useFinancialPrivacy';
import { formatCurrency, normalizeClientKey } from '@/utils/data';
import type { ClientsStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<ClientsStackParamList, 'ClientPayments'>;

export function ClientPayments({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const { hidden } = useFinancialPrivacy();
  const { snapshot } = useClients();
  const deliveries =
    snapshot?.entregas.filter((delivery) => {
      const sameClient =
        normalizeClientKey(delivery.cliente) === normalizeClientKey(route.params.clientName);
      return sameClient && (!route.params.onlyPending || delivery.status !== 'Pago');
    }) ?? [];

  return (
    <Screen>
      <LargeTitleHeader
        onBack={() => navigation.goBack()}
        subtitle="Pagamentos são derivados das entregas"
        title="Pagamentos"
      />
      {deliveries.length === 0 ? (
        <EmptyState
          description="Não há pagamentos para exibir neste filtro."
          title="Nenhum pagamento"
        />
      ) : (
        <FlatList
          contentContainerStyle={{ gap: theme.spacing.sm, padding: theme.spacing.md }}
          data={deliveries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PaymentCard
              amountLabel={hidden ? '••••' : formatCurrency(item.valor)}
              clientName={item.cliente}
              dateLabel={item.data}
              deliveryLabel={`${item.quantidade} balde(s)`}
              methodLabel={item.metodoPagamento ?? 'Método não informado'}
              status={item.status === 'Pago' ? 'Pago' : 'Não Pago'}
            />
          )}
        />
      )}
    </Screen>
  );
}
