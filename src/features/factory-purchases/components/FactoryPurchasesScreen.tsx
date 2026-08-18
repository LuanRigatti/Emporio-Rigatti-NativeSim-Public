import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { NativeButton, NativeDatePicker, NativeTextField } from '@/components/native';
import { ConfirmationDialog } from '@/components/overlays';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useFactoryPurchases } from '@/hooks/useFactoryPurchases';
import { useFactorySettings } from '@/hooks/useFactorySettings';
import {
  factoryPurchaseCalculationService,
  type FactoryPurchaseSummary,
} from '@/services/factory-purchases';
import { useAppTheme } from '@/theme';
import { formatCurrency, formatPtBrDate, normalizeMoney, todayIso } from '@/utils/data';

import { PurchaseDetailsSheet } from './PurchaseDetailsSheet';
import type { Purchase } from '../types';

function parseQuantity(value: string): number {
  const quantity = Number.parseInt(value, 10);
  return Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
}

export function FactoryPurchasesScreen({
  header,
  selectedMonth,
  selectedYear,
}: {
  header: ReactNode;
  selectedMonth: number;
  selectedYear: number;
}) {
  const { theme } = useAppTheme();
  const { settings: factorySettings } = useFactorySettings();
  const { addPayment, createPurchase, deletePurchase, purchaseById, purchases } =
    useFactoryPurchases({
      month: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`,
      period: 'month',
    });
  const [quantity, setQuantity] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date());
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [purchaseSheetVisible, setPurchaseSheetVisible] = useState(false);
  const [purchaseToDeleteId, setPurchaseToDeleteId] = useState<string | null>(null);
  const [blurQuantityField, setBlurQuantityField] = useState<(() => void) | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const unitPrice = normalizeMoney(factorySettings.bucketCost) ?? 0;
  const quantityValue = parseQuantity(quantity);
  const estimatedTotal = quantityValue * unitPrice;
  const visiblePurchases = useMemo(
    () => factoryPurchaseCalculationService.filterByPeriod(purchases, selectedYear, selectedMonth),
    [purchases, selectedMonth, selectedYear],
  );
  const summary = useMemo<FactoryPurchaseSummary>(
    () => factoryPurchaseCalculationService.summarize(visiblePurchases),
    [visiblePurchases],
  );
  const selectedPurchase = selectedPurchaseId
    ? (purchaseById.get(selectedPurchaseId) ?? null)
    : null;
  const handleQuantityBlurReady = useCallback((blur: () => void) => {
    setBlurQuantityField(() => blur);
  }, []);
  const handleCreatePurchase = async () => {
    if (isRegistering) return;
    blurQuantityField?.();
    Keyboard.dismiss();

    if (quantityValue <= 0) {
      setError('Informe uma quantidade de baldes maior que zero.');
      return;
    }
    if (unitPrice <= 0) {
      setError('Configure o valor do balde antes de registrar uma compra.');
      return;
    }

    setIsRegistering(true);
    try {
      await createPurchase({
        bucketQuantity: quantityValue,
        bucketUnitPrice: unitPrice,
        date: todayIso(purchaseDate),
      });
      setQuantity('');
      setError(undefined);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : 'Não foi possível registrar a compra.',
      );
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <>
      <PremiumScreen
        contentContainerStyle={styles.content}
        overlayHeader={header}
        overlayHeaderSpacing={theme.spacing.md}
        scrollViewProps={{ scrollEventThrottle: 16 }}
      >
        <GlassCard style={styles.summaryCard}>
          <SummaryMetric label="Total pago" value={formatCurrency(summary.totalPaid)} />
          <SummaryMetric label="Valor em aberto" value={formatCurrency(summary.openValue)} />
          <SummaryMetric label="Total de baldes" value={String(summary.totalBuckets)} />
        </GlassCard>

        <GlassCard style={styles.formCard}>
          <View style={styles.formHeadingRow}>
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              Registrar compra
            </Text>
            <NativeDatePicker
              accessibilityLabel="Data da compra"
              mode="date"
              onChange={setPurchaseDate}
              style="compact"
              value={purchaseDate}
            />
          </View>
          <View style={styles.formTopRow}>
            <View style={styles.quantityField}>
              <NativeTextField
                accessibilityLabel="Quantidade de baldes"
                keyboardType="number-pad"
                onChangeText={setQuantity}
                onBlurReady={handleQuantityBlurReady}
                placeholder="Quantidade de baldes"
                value={quantity}
              />
            </View>
          </View>
          {error ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.danger }]}>{error}</Text>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
              Valor total estimado
            </Text>
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
              {formatCurrency(estimatedTotal)}
            </Text>
          </View>
          <View style={styles.formAction}>
            <NativeButton
              accessibilityLabel="Registrar compra"
              disabled={isRegistering}
              haptic="light"
              label="Registrar"
              onPress={() => void handleCreatePurchase()}
              variant="primary"
            />
          </View>
        </GlassCard>

        <View style={styles.purchasesTitle}>
          <Text
            style={[
              theme.typography.footnote,
              styles.purchasesTitleText,
              { color: theme.colors.textSecondary },
            ]}
          >
            Compras
          </Text>
        </View>
        {visiblePurchases.length > 0 ? (
          <View style={styles.purchaseList}>
            {visiblePurchases.map((purchase) => (
              <PurchaseRow
                key={purchase.id}
                onDelete={() => setPurchaseToDeleteId(purchase.id)}
                onPress={() => {
                  setSelectedPurchaseId(purchase.id);
                  setPurchaseSheetVisible(true);
                }}
                purchase={purchase}
              />
            ))}
          </View>
        ) : (
          <Text
            style={[
              theme.typography.body,
              styles.emptyStateText,
              { color: theme.colors.textSecondary },
            ]}
          >
            Nenhuma compra registrada.
          </Text>
        )}
      </PremiumScreen>

      <PurchaseDetailsSheet
        onAddPayment={async (purchaseId, payment) => {
          await addPayment(purchaseId, payment);
        }}
        onVisibleChange={(visible) => {
          setPurchaseSheetVisible(visible);
          if (!visible) setSelectedPurchaseId(null);
        }}
        purchase={selectedPurchase}
        visible={purchaseSheetVisible}
      />
      <ConfirmationDialog
        confirmLabel="Excluir"
        destructive
        message="Essa compra e os pagamentos vinculados serão removidos."
        onCancel={() => setPurchaseToDeleteId(null)}
        onConfirm={() => {
          if (!purchaseToDeleteId) return;
          void deletePurchase(purchaseToDeleteId)
            .then(() => setPurchaseToDeleteId(null))
            .catch((deleteError) => {
              setError(
                deleteError instanceof Error
                  ? deleteError.message
                  : 'Não foi possível excluir a compra.',
              );
            });
        }}
        title="Excluir compra?"
        visible={purchaseToDeleteId !== null}
      />
    </>
  );
}

function PurchaseRow({
  onDelete,
  onPress,
  purchase,
}: {
  onDelete: () => void;
  onPress: () => void;
  purchase: Purchase;
}) {
  const { theme } = useAppTheme();
  const paidAmount = factoryPurchaseCalculationService.paidAmount(purchase);
  const remainingAmount = factoryPurchaseCalculationService.remainingAmount(purchase);
  const isPaid = factoryPurchaseCalculationService.isPaid(purchase);

  return (
    <GlassCard style={styles.purchaseCard}>
      <View style={styles.purchaseHeader}>
        <View style={styles.purchaseCopy}>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
            {formatPtBrDate(purchase.date)}
          </Text>
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            {purchase.bucketQuantity} baldes · {formatCurrency(purchase.totalAmount)}
          </Text>
        </View>
        <Text
          style={[
            theme.typography.footnote,
            { color: isPaid ? theme.colors.paid : theme.colors.unpaid },
          ]}
        >
          {isPaid ? 'Pago' : 'Em aberto'}
        </Text>
      </View>
      <View style={styles.purchaseAmounts}>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          Pago {formatCurrency(paidAmount)}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          Saldo {formatCurrency(remainingAmount)}
        </Text>
      </View>
      <View style={styles.purchaseActions}>
        <NativeButton
          accessibilityLabel="Adicionar detalhes da compra"
          haptic="light"
          label="Adicionar"
          onPress={onPress}
          variant="surface"
        />
        <NativeButton
          accessibilityLabel="Excluir compra"
          controlSize="small"
          destructive
          haptic="light"
          label="Excluir"
          onPress={onDelete}
          variant="glass"
        />
      </View>
    </GlassCard>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.summaryMetric}>
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{label}</Text>
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 32 },
  summaryCard: { gap: 12 },
  summaryMetric: { gap: 4 },
  formCard: { gap: 12 },
  formAction: { alignItems: 'flex-end' },
  formHeadingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  formTopRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  quantityField: { flex: 1 },
  totalRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  purchasesTitle: { alignItems: 'center', width: '100%' },
  purchasesTitleText: { textAlign: 'center', width: '100%' },
  purchaseList: { gap: 14 },
  emptyStateText: { textAlign: 'center', width: '100%' },
  purchaseCard: { gap: 12 },
  purchaseHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  purchaseCopy: { flex: 1, gap: 4 },
  purchaseAmounts: { flexDirection: 'row', justifyContent: 'space-between' },
  purchaseActions: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
