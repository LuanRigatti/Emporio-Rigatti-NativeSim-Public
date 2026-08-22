import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { NativeButton, NativeDatePicker, NativeSheet, NativeTextField } from '@/components/native';
import { GlassCard } from '@/components/premium';
import { factoryPurchaseCalculationService } from '@/services/factory-purchases';
import { useAppTheme } from '@/theme';
import { formatPtBrDate, normalizeMoney, todayIso } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type { Purchase } from '../types';

type PurchaseDetailsSheetProps = {
  purchase: Purchase | null;
  visible: boolean;
  onAddPayment: (
    purchaseId: string,
    payment: { date: string; amount: number },
  ) => void | Promise<void>;
  onVisibleChange: (visible: boolean) => void;
};

export function PurchaseDetailsSheet({
  onAddPayment,
  onVisibleChange,
  purchase,
  visible,
}: PurchaseDetailsSheetProps) {
  const { theme } = useAppTheme();
  const { currency: maskCurrency, number: maskNumber, enabled: testModeEnabled } =
    useTestModePresentation();
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [paymentAmount, setPaymentAmount] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const isAddingPaymentRef = useRef(false);

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

  const handleAddPayment = async () => {
    if (__DEV__) {
      console.log('[FactoryPayment] addPaymentPressed', {
        hasPurchase: Boolean(purchase),
        receiptId: purchase ? maskReceiptId(purchase.id) : null,
      });
    }
    if (!purchase || isAddingPaymentRef.current || testModeEnabled) return;

    const amount = normalizeMoney(paymentAmount);
    const date = todayIso(paymentDate);
    if (__DEV__) {
      console.log('[FactoryPayment] paymentPayload', {
        amount,
        date,
        receiptId: maskReceiptId(purchase.id),
      });
    }
    if (amount === undefined) {
      setError('Informe um valor de pagamento maior que zero.');
      return;
    }

    isAddingPaymentRef.current = true;
    setIsAddingPayment(true);
    try {
      await onAddPayment(purchase.id, { amount, date });
      setPaymentAmount('');
      setError(undefined);
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : 'Não foi possível adicionar o pagamento.',
      );
    } finally {
      isAddingPaymentRef.current = false;
      setIsAddingPayment(false);
    }
  };

  return (
    <NativeSheet onVisibleChange={onVisibleChange} title="Detalhes da compra" visible={visible}>
      {purchase ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <GlassCard
            style={[styles.card, { borderRadius: theme.radius.xl + theme.spacing.sm, width: '100%' }]}
          >
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            {formatPtBrDate(purchase.date)}
          </Text>
          <View style={styles.summary}>
            <DetailRow label="Baldes" value={maskNumber(purchase.bucketQuantity)} />
            <DetailRow label="Valor do balde" value={maskCurrency(purchase.bucketUnitPrice)} />
            <DetailRow label="Valor total" value={maskCurrency(purchase.totalAmount)} />
            <DetailRow label="Total pago" value={maskCurrency(paidAmount)} />
            <DetailRow label="Saldo restante" value={maskCurrency(remainingAmount)} />
            <DetailRow label="Status" value={isPaid ? 'Pago' : 'Em aberto'} />
          </View>
          </GlassCard>

          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Histórico de pagamentos
          </Text>
          <GlassCard
            style={[styles.card, { borderRadius: theme.radius.xl + theme.spacing.sm, width: '100%' }]}
          >
          {purchase.payments.length > 0 ? (
            purchase.payments.map((payment) => (
              <DetailRow
                key={payment.id}
                label={formatPtBrDate(payment.date)}
                value={maskCurrency(payment.amount)}
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
                disabled={isAddingPayment || testModeEnabled}
                onPress={handleAddPayment}
                variant="primary"
              />
            </View>
          ) : null}
          </GlassCard>
        </ScrollView>
      ) : null}
    </NativeSheet>
  );
}

function maskReceiptId(receiptId: string): string {
  return receiptId.length <= 8 ? receiptId : `${receiptId.slice(0, 4)}…${receiptId.slice(-4)}`;
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
  card: { gap: 14 },
  content: { paddingBottom: 24 },
  summary: { gap: 8 },
  detailRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  paymentForm: { gap: 10, marginTop: 8 },
  paymentFields: { gap: 10 },
});
