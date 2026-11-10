import { Alert, Text, View, useWindowDimensions } from 'react-native';

import { BottomSheet, ErrorState, PrimaryButton, SegmentedControl } from '@/components';
import { useAppTheme } from '@/theme';

import type { HistoryPaymentSheetProps } from './HistoryPaymentSheet.types';

const deliveryOptions = [
  { label: 'Pendente', value: 'Pendente' },
  { label: 'Entregue', value: 'Entregue' },
] as const;

const paymentOptions = [
  { label: 'Não pago', value: 'Não Pago' },
  { label: 'Pix', value: 'Pix' },
  { label: 'Dinheiro', value: 'Dinheiro' },
] as const;

export default function HistoryPaymentSheet({
  amount,
  clientName,
  delivered,
  error,
  isPaid,
  paymentSelection,
  saving,
  visible,
  onCancel,
  onConfirm,
  onDeliveredChange,
  onPaymentSelectionChange,
}: HistoryPaymentSheetProps) {
  const { theme } = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const pickerInterSectionSpacing =
    theme.spacing.md + theme.typography.footnote.lineHeight * fontScale + theme.spacing.xxs;
  const requiresDeliveredForNewPayment = !isPaid && paymentSelection !== 'Não Pago' && !delivered;

  const handleConfirm = () => {
    if (isPaid && paymentSelection === 'Não Pago') {
      Alert.alert(
        'Desfazer pagamento?',
        'O pagamento será removido e a entrega voltará para Recebimentos em aberto, se continuar entregue.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Desfazer pagamento',
            style: 'destructive',
            onPress: () => onConfirm(true),
          },
        ],
      );
      return;
    }

    onConfirm(false);
  };

  return (
    <BottomSheet
      footer={
        <PrimaryButton
          disabled={saving || requiresDeliveredForNewPayment}
          fullWidth
          loading={saving}
          onPress={handleConfirm}
        >
          Confirmar
        </PrimaryButton>
      }
      onClose={onCancel}
      title="Entrega e pagamento"
      visible={visible}
    >
      <View style={{ gap: theme.spacing.md }}>
        <View style={{ gap: theme.spacing.xxs }}>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
            {clientName}
          </Text>
          <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
            {amount}
          </Text>
        </View>

        <View style={{ gap: pickerInterSectionSpacing }}>
          <SegmentedControl
            accessibilityLabel="Status da entrega"
            disabled={saving}
            options={deliveryOptions}
            value={delivered ? 'Entregue' : 'Pendente'}
            onChange={(value) => onDeliveredChange(value === 'Entregue')}
          />
          <SegmentedControl
            accessibilityLabel="Status do pagamento: Não pago, Pix ou Dinheiro"
            disabled={saving}
            options={paymentOptions}
            value={paymentSelection}
            onChange={onPaymentSelectionChange}
          />
        </View>

        {error ? (
          <ErrorState description={error} title="Não foi possível salvar os estados" />
        ) : requiresDeliveredForNewPayment ? (
          <Text style={[theme.typography.footnote, { color: theme.colors.danger }]}>
            Marque a entrega como Entregue para registrar o pagamento.
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}
