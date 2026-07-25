import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { View } from 'react-native';

import {
  ClientCard,
  FinanceCard,
  LargeTitleHeader,
  PrimaryButton,
  Screen,
  ScrollScreen,
  Section,
  SecondaryButton,
  TextButton,
} from '@/components';
import { useClients } from '@/hooks/useClients';
import { useFinancialPrivacy } from '@/hooks/useFinancialPrivacy';
import { summarizeClient } from '@/services/clients';
import { formatCurrency } from '@/utils/data';
import type { ClientsStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<ClientsStackParamList, 'ClientDetails'>;

export function ClientDetails({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const { hidden } = useFinancialPrivacy();
  const { snapshot, clients, loading } = useClients();
  const client = useMemo(
    () => clients.find((item) => item.clientId === route.params.clientId),
    [clients, route.params.clientId],
  );
  const summary =
    client && snapshot ? summarizeClient(snapshot.entregas, client.normalizedName) : null;

  if (loading || !client || !summary || !snapshot) {
    return (
      <Screen>
        <LargeTitleHeader onBack={() => navigation.goBack()} title={route.params.clientName} />
        <View style={{ flex: 1, padding: theme.spacing.lg }}>
          <FinanceCard label="Resumo" loading value="" />
        </View>
      </Screen>
    );
  }

  return (
    <ScrollScreen>
      <LargeTitleHeader
        onBack={() => navigation.goBack()}
        rightAction={
          <TextButton
            onPress={() =>
              navigation.navigate('ClientForm', {
                mode: 'edit',
                clientId: client.clientId,
                clientName: client.canonicalName,
              })
            }
          >
            Editar
          </TextButton>
        }
        subtitle={
          client.hasIncompleteAddress
            ? 'Cadastro incompleto: informe o endereço antes de usar mapas e rotas.'
            : client.address
        }
        title={client.canonicalName}
      />
      <View style={{ paddingHorizontal: theme.spacing.md }}>
        <ClientCard
          address={client.address ?? 'Endereço pendente'}
          name={client.canonicalName}
          secondaryText={
            client.currentPrice === undefined
              ? 'Preço não disponível'
              : `Preço: ${hidden ? '••••' : formatCurrency(client.currentPrice)}`
          }
        />
        <Section style={{ marginTop: theme.spacing.md }} title="Resumo financeiro">
          <FinanceCard
            hidden={hidden}
            label="Faturamento"
            value={formatCurrency(summary.revenue)}
          />
          <FinanceCard hidden={hidden} label="Valores pagos" value={formatCurrency(summary.paid)} />
          <FinanceCard
            hidden={hidden}
            label="Valores pendentes"
            value={formatCurrency(summary.pending)}
          />
        </Section>
        <Section title="Ações">
          <PrimaryButton
            fullWidth
            onPress={() =>
              navigation.navigate('ClientDeliveries', {
                clientId: client.clientId,
                clientName: client.canonicalName,
              })
            }
          >
            Ver entregas
          </PrimaryButton>
          <SecondaryButton
            fullWidth
            onPress={() =>
              navigation.navigate('ClientPayments', {
                clientId: client.clientId,
                clientName: client.canonicalName,
                onlyPending: true,
              })
            }
          >
            Ver pagamentos pendentes
          </SecondaryButton>
          <SecondaryButton
            fullWidth
            onPress={() =>
              navigation.navigate('ClientRenameReview', {
                clientId: client.clientId,
                clientName: client.canonicalName,
              })
            }
          >
            Renomear cliente
          </SecondaryButton>
          <SecondaryButton
            fullWidth
            icon={
              <Ionicons
                color={theme.colors.danger}
                name="trash-outline"
                size={theme.sizes.iconSmall}
              />
            }
            onPress={() =>
              navigation.navigate('ClientDeleteReview', {
                clientId: client.clientId,
                clientName: client.canonicalName,
              })
            }
          >
            Excluir configuração personalizada
          </SecondaryButton>
        </Section>
      </View>
    </ScrollScreen>
  );
}
