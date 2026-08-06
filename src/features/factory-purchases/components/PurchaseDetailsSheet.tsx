import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { NativeButton, NativeDatePicker, NativeSheet, NativeTextField } from '@/components/native';
import { factoryPurchaseCalculationService } from '@/services/factory-purchases';
import { useAppTheme } from '@/theme';
import { formatCurrency, formatPtBrDate, normalizeMoney, todayIso } from '@/utils/data';

import type { Purchase } from '../types';

type PurchaseDetailsSheetProps = {
  purchase: Purchase | null;
  visible: boolean;
  onAddPayment: (purchaseId: string, payment: { date: string; amount: number }) => void;
  onVisibleChange: (visible: boolean) => void;
};

export function PurchaseDetailsSheet({
  onAddPayment,
  onVisibleChange,
  purchase,
  visible,
}: PurchaseDetailsSheetProps) {
  const { theme } = useAppTheme();
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [paymentAmount, setPaymentAmount] = useState('');
  const [error, setError] = useState<string | undefined>();

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!visible || !purchase) return;
    setPaymentDate(new Date());
    setPaymentAmount('');
    setError(undefined);
  }, [purchase, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const paidAmount = purchase ? factoryPurchaseCalculationService.paidAmount(purchase) : 0;
  const remainingAmount = purchase
    ? factoryPurchaseCalculationService.remainingAmount(purchase)
    : 0;
  const isPaid = purchase ? factoryPurchaseCalculationService.isPaid(purchase) : false;

  const handleAddPayment = () => {
    if (!purchase) return;

    const amount = normalizeMoney(paymentAmount);
    if (amount === undefined) {
      setError('Informe um valor de pagamento maior que zero.');
      return;
    }

    try {
      onAddPayment(purchase.id, { amount, date: todayIso(paymentDate) });
      setPaymentAmount('');
      setError(undefined);
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : 'Não foi possível adicionar o pagamento.',
      );
    }
  };

  return (
    <NativeSheet onVisibleChange={onVisibleChange} title="Detalhes da compra" visible={visible}>
      {purchase ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            {formatPtBrDate(purchase.date)}
          </Text>
          <View style={styles.summary}>
            <DetailRow label="Baldes" value={String(purchase.bucketQuantity)} />
            <DetailRow label="Valor do balde" value={formatCurrency(purchase.bucketUnitPrice)} />
            <DetailRow label="Valor total" value={formatCurrency(purchase.totalAmount)} />
            <DetailRow label="Total pago" value={formatCurrency(paidAmount)} />
            <DetailRow label="Saldo restante" value={formatCurrency(remainingAmount)} />
            <DetailRow label="Status" value={isPaid ? 'Pago' : 'Em aberto'} />
          </View>

          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Histórico de pagamentos
          </Text>
          {purchase.payments.length > 0 ? (
            purchase.payments.map((payment) => (
              <DetailRow
                key={payment.id}
                label={formatPtBrDate(payment.date)}
                value={formatCurrency(payment.amount)}
              />
            ))
          ) : (
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
              Nenhum pagamento registrado.
            </Text>
          )}

          {!isPaid ? (
            <View style={styles.paymentForm}>
              <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                Novo pagamento
              </Text>
              <View style={styles.paymentFields}>
                <NativeDatePicker
                  accessibilityLabel="Data do pagamento"
                  mode="date"
                  onChange={setPaymentDate}
                  style="compact"
                  value={paymentDate}
                />
                <NativeTextField
                  accessibilityLabel="Valor pago"
                  keyboardType="decimal-pad"
                  onChangeText={setPaymentAmount}
                  placeholder="R$ 0,00"
                  value={paymentAmount}
                />
              </View>
              {error ? (
                <Text style={[theme.typography.footnote, { color: theme.colors.danger }]}>
                  {error}
                </Text>
              ) : null}
              <NativeButton
                accessibilityLabel="Adicionar pagamento"
                haptic="light"
                label="Adicionar pagamento"
                onPress={handleAddPayment}
                variant="primary"
              />
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </NativeSheet>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.detailRow}>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{label}</Text>
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 24 },
  summary: { gap: 8 },
  detailRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  paymentForm: { gap: 10, marginTop: 8 },
  paymentFields: { gap: 10 },
});
