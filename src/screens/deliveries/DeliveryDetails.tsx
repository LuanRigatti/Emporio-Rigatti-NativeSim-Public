import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  ConfirmationDialog,
  DeliveryCard,
  DestructiveButton,
  EmptyState,
  ErrorState,
  LargeTitleHeader,
  PrimaryButton,
  Section,
  StatusChip,
  SwitchField,
  TextButton,
} from '@/components';
import { Screen } from '@/components/layout';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useFinancialPrivacy } from '@/hooks/useFinancialPrivacy';
import type { DeliveriesStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<DeliveriesStackParamList, 'DeliveryDetails'>;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { currency: 'BRL', style: 'currency' }).format(value);
}

export function DeliveryDetails({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const { hidden } = useFinancialPrivacy();
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();
  const { allDeliveries, loading, error, remove, toggleDelivered, updateInvoiceStatus } =
    useDeliveries({ mode: 'all', deliveryId: route.params.deliveryId });
  const delivery = allDeliveries.find((item) => item.id === route.params.deliveryId);

  if (loading && !delivery) {
    return (
      <Screen>
        <Text style={{ color: theme.colors.textSecondary }}>Carregando entrega...</Text>
      </Screen>
    );
  }
  if (error && !delivery) {
    return (
      <Screen>
        <ErrorState
          description={error}
          onRetry={() => navigation.goBack()}
          title="Não foi possível carregar a entrega"
        />
      </Screen>
    );
  }
  if (!delivery) {
    return (
      <Screen>
        <EmptyState
          title="Entrega não encontrada"
          description="O registro pode ter sido removido."
        />
      </Screen>
    );
  }

  const run = async (operation: () => Promise<void>) => {
    try {
      setActionError(undefined);
      await operation();
    } catch (operationError) {
      setActionError(
        operationError instanceof Error
          ? operationError.message
          : 'Não foi possível concluir a ação.',
      );
    }
  };

  return (
    <Screen>
      <LargeTitleHeader
        onBack={() => navigation.goBack()}
        rightAction={
          <TextButton
            onPress={() => navigation.navigate('EditDelivery', { deliveryId: delivery.id })}
          >
            Editar
          </TextButton>
        }
        title="Detalhes"
      />
      <View style={{ flex: 1, gap: theme.spacing.md, padding: theme.spacing.md }}>
        <DeliveryCard
          clientName={delivery.cliente}
          dateLabel={delivery.data}
          delivered={delivery.entregue}
          quantityLabel={`${delivery.quantidade} balde(s)`}
          status={delivery.status === 'Pago' ? 'Pago' : 'Não Pago'}
          totalLabel={hidden ? '••••' : formatCurrency(delivery.valor)}
        />
        <Section title="Registro">
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
            Endereço: {delivery.endereco ?? 'Não informado'}
          </Text>
          <Text
            style={[
              theme.typography.body,
              { color: theme.colors.textPrimary, marginTop: theme.spacing.xs },
            ]}
          >
            Método: {delivery.metodoPagamento ?? 'Ainda não quitada'}
          </Text>
          <View
            style={{
              alignItems: 'flex-start',
              flexDirection: 'row',
              gap: theme.spacing.xs,
              marginTop: theme.spacing.sm,
            }}
          >
            <StatusChip status={delivery.status === 'Pago' ? 'Pago' : 'Não Pago'} />
            <StatusChip status={delivery.invoiceStatus === 'emitido' ? 'Emitido' : 'A emitir'} />
          </View>
        </Section>
        <Section title="Ações">
          <SwitchField
            label="Entrega realizada"
            value={delivery.entregue}
            onValueChange={() => void run(() => toggleDelivered(delivery.id))}
          />
          <TextButton
            onPress={() =>
              void run(() =>
                updateInvoiceStatus(
                  delivery.id,
                  delivery.invoiceStatus === 'emitido' ? 'a_emitir' : 'emitido',
                ),
              )
            }
          >
            Marcar nota como {delivery.invoiceStatus === 'emitido' ? 'a emitir' : 'emitida'}
          </TextButton>
          {delivery.status !== 'Pago' && delivery.entregue ? (
            <PrimaryButton
              fullWidth
              onPress={() =>
                navigation.navigate('DeliverySettlement', { deliveryIds: [delivery.id] })
              }
              style={{ marginTop: theme.spacing.sm }}
            >
              Quitar entrega
            </PrimaryButton>
          ) : null}
          <DestructiveButton
            fullWidth
            onPress={() => setDeleteVisible(true)}
            style={{ marginTop: theme.spacing.sm }}
          >
            Excluir entrega
          </DestructiveButton>
        </Section>
        {actionError ? (
          <ErrorState
            description={actionError}
            onRetry={() => setActionError(undefined)}
            title="Ação não concluída"
          />
        ) : null}
      </View>
      <ConfirmationDialog
        confirmLabel="Excluir entrega"
        destructive
        message="A entrega será removida do registro atual."
        onCancel={() => setDeleteVisible(false)}
        onConfirm={() =>
          void run(async () => {
            await remove(delivery.id);
            setDeleteVisible(false);
            navigation.goBack();
          })
        }
        title="Excluir entrega?"
        visible={deleteVisible}
      />
    </Screen>
  );
}
