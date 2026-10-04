import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { NativeButton, NativeSheet } from '@/components/native';
import { GlassCard } from '@/components/premium';
import { factoryPurchaseCalculationService } from '@/services/factory-purchases';
import { getInsetSurfaceColor, useAppTheme } from '@/theme';
import { formatPtBrDate } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type { Purchase } from '../types';

type PurchaseDetailsSheetProps = {
  purchase: Purchase | null;
  visible: boolean;
  onRequestAddPayment: (purchaseId: string) => void;
  onVisibleChange: (visible: boolean) => void;
  onDismiss: () => void;
};

export function PurchaseDetailsSheet({
  onRequestAddPayment,
  onDismiss,
  onVisibleChange,
  purchase,
  visible,
}: PurchaseDetailsSheetProps) {
  const { resolvedMode, theme } = useAppTheme();
  const {
    currency: maskCurrency,
    number: maskNumber,
    enabled: testModeEnabled,
  } = useTestModePresentation();

  const paidAmount = purchase ? factoryPurchaseCalculationService.paidAmount(purchase) : 0;
  const remainingAmount = purchase
    ? factoryPurchaseCalculationService.remainingAmount(purchase)
    : 0;
  const isPaid = purchase ? factoryPurchaseCalculationService.isPaid(purchase) : false;

  return (
    <NativeSheet
      onDismiss={onDismiss}
      onVisibleChange={onVisibleChange}
      title="Detalhes da compra"
      visible={visible}
    >
      {purchase ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <GlassCard
            style={[
              styles.card,
              {
                backgroundColor: getInsetSurfaceColor(resolvedMode, theme.colors.glassSurface),
                borderRadius: theme.radius.xl + theme.spacing.sm,
                width: '100%',
              },
            ]}
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
            style={[
              styles.card,
              {
                backgroundColor: getInsetSurfaceColor(resolvedMode, theme.colors.glassSurface),
                borderRadius: theme.radius.xl + theme.spacing.sm,
                width: '100%',
              },
            ]}
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
              <View style={styles.paymentAction}>
                <NativeButton
                  accessibilityLabel="Adicionar pagamento"
                  haptic="light"
                  label="Adicionar pagamento"
                  disabled={testModeEnabled}
                  onPress={() => onRequestAddPayment(purchase.id)}
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
  paymentAction: { marginTop: 8 },
});
