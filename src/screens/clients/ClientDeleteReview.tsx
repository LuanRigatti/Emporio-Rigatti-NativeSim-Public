import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  ConfirmationDialog,
  DestructiveButton,
  LargeTitleHeader,
  ScrollScreen,
  Section,
} from '@/components';
import { useClients } from '@/hooks/useClients';
import { useDeliveries } from '@/hooks/useDeliveries';
import { calculateClientImpact } from '@/services/clients';
import type { ClientsStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<ClientsStackParamList, 'ClientDeleteReview'>;

export function ClientDeleteReview({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const { clients, removeCustomConfiguration } = useClients();
  const client = clients.find((item) => item.clientId === route.params.clientId);
  const { deliveries } = useDeliveries({ mode: 'all', clientId: client?.clientId });
  const impact = client
    ? calculateClientImpact(
        { clientesCustom: {}, entregas: deliveries, gastosDiarios: {}, gastosMensais: {}, recebimentoBaldes: [] },
        client,
      )
    : undefined;
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handleConfirm = async () => {
    if (!client) return;
    setSaving(true);
    setError(undefined);
    try {
      await removeCustomConfiguration(client);
      navigation.popTo('ClientsHome');
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Não foi possível excluir a configuração.',
      );
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  };

  return (
    <ScrollScreen>
      <LargeTitleHeader onBack={() => navigation.goBack()} title="Excluir configuração" />
      <View style={{ padding: theme.spacing.lg }}>
        <Section title="O que será removido">
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            Somente o registro personalizado de {route.params.clientName} será removido.
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            Entregas, pagamentos e histórico serão preservados.
          </Text>
          {impact ? (
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
              {impact.deliveryCount} entregas e {impact.relatedPaymentCount} pagamentos relacionados
              permanecerão intactos.
            </Text>
          ) : null}
          {error ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.danger }]}>{error}</Text>
          ) : null}
        </Section>
        <DestructiveButton fullWidth onPress={() => setConfirming(true)}>
          Excluir configuração personalizada
        </DestructiveButton>
      </View>
      <ConfirmationDialog
        confirmLabel="Excluir configuração"
        destructive
        loading={saving}
        message="Esta ação remove somente a configuração personalizada. O histórico continuará preservado. Um backup preventivo será gerado antes da operação."
        onCancel={() => setConfirming(false)}
        onConfirm={() => void handleConfirm()}
        title="Confirmar exclusão"
        visible={confirming}
      />
    </ScrollScreen>
  );
}
