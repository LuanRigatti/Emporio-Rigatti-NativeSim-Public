import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  BottomSheet,
  ErrorState,
  PaymentMethodSelector,
  PrimaryButton,
  SecondaryButton,
} from '@/components';
import { Screen } from '@/components/layout';
import { useDeliveries } from '@/hooks/useDeliveries';
import type { DeliveriesStackParamList } from '@/navigation/types';
import type { PaymentMethod } from '@/types/data';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<DeliveriesStackParamList, 'DeliverySettlement'>;

export function DeliverySettlement({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const [method, setMethod] = useState<PaymentMethod | undefined>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const { settle } = useDeliveries({ mode: 'all', deliveryIds: route.params.deliveryIds });

  const confirm = async () => {
    if (!method) {
      setError('Escolha Dinheiro ou Pix para quitar.');
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await settle(route.params.deliveryIds, method);
      navigation.goBack();
    } catch (settlementError) {
      setError(
        settlementError instanceof Error ? settlementError.message : 'Não foi possível quitar.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <BottomSheet
        title="Quitar entrega(s)"
        visible
        onClose={() => navigation.goBack()}
        footer={
          <View style={{ gap: theme.spacing.sm }}>
            <SecondaryButton fullWidth onPress={() => navigation.goBack()}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton fullWidth loading={saving} onPress={() => void confirm()}>
              Confirmar quitação
            </PrimaryButton>
          </View>
        }
      >
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          Selecione o método usado para registrar o pagamento.
        </Text>
        <PaymentMethodSelector
          required
          error={error}
          value={method}
          onChange={setMethod}
          style={{ marginTop: theme.spacing.md }}
        />
        {error ? <ErrorState description={error} title="Não foi possível quitar" /> : null}
      </BottomSheet>
    </Screen>
  );
}
