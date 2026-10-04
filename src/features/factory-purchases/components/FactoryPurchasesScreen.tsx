import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Keyboard, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import {
  NativeButton,
  NativeCardContextMenu,
  NativeDatePicker,
  NativeTextField,
} from '@/components/native';
import { ConfirmationDialog } from '@/components/overlays';
import { GlassCard, PremiumScreen, ProgressiveCollapsibleScreen } from '@/components/premium';
import { useFactoryPurchases } from '@/hooks/useFactoryPurchases';
import { useFactorySettings } from '@/hooks/useFactorySettings';
import {
  factoryPurchaseCalculationService,
  type FactoryPurchaseSummary,
} from '@/services/factory-purchases';
import { getCardSurfaceColor, getLiquidGlassTint, useAppTheme } from '@/theme';
import { formatPtBrDate, normalizeMoney, todayIso } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type { Purchase } from '../types';

function parseQuantity(value: string): number {
  const quantity = Number.parseInt(value, 10);
  return Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
}

export function FactoryPurchasesScreen({
  header,
  mode = 'all',
  pageTitle,
  selectedMonth,
  selectedYear,
}: {
  header: ReactNode;
  mode?: 'all' | 'purchases' | 'register';
  pageTitle?: ReactNode;
  selectedMonth: number;
  selectedYear: number;
}) {
  const router = useRouter();
  const { resolvedMode, theme } = useAppTheme();
  const {
    currency: maskCurrency,
    number: maskNumber,
    enabled: testModeEnabled,
  } = useTestModePresentation();
  const { settings: factorySettings } = useFactorySettings();
  const { createPurchase, dataUnavailable, deletePurchase, purchases } = useFactoryPurchases({
    month: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`,
    period: 'month',
  });
  const [quantity, setQuantity] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date());
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
  const handleQuantityBlurReady = useCallback((blur: () => void) => {
    setBlurQuantityField(() => blur);
  }, []);
  const handleCreatePurchase = async () => {
    if (isRegistering || testModeEnabled) return;
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

  const originalContentTopOffset = theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2;
  const pageTitleBlock = (
    <>
      {pageTitle ? (
        <View
          style={[
            styles.pageTitleBlock,
            {
              marginBottom: theme.spacing.xs,
              marginTop: theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2,
            },
          ]}
        >
          {pageTitle}
        </View>
      ) : null}
    </>
  );
  const factoryContent = (
    <>
      {mode !== 'purchases' ? (
        <GlassCard style={[styles.formCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}>
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
              {maskCurrency(estimatedTotal)}
            </Text>
          </View>
          <View style={styles.formAction}>
            <NativeButton
              accessibilityLabel="Registrar compra"
              disabled={isRegistering || testModeEnabled}
              glassTint={resolvedMode === 'dark' ? getLiquidGlassTint(resolvedMode) : undefined}
              haptic="light"
              label="Registrar"
              onPress={() => void handleCreatePurchase()}
              variant="primary"
            />
          </View>
        </GlassCard>
      ) : null}

      {mode !== 'register' ? (
        <>
          <GlassCard
            style={[styles.summaryCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
          >
            <SummaryMetric
              label="Total pago"
              value={dataUnavailable ? 'Indisponível' : maskCurrency(summary.totalPaid)}
            />
            <SummaryMetric
              label="Valor em aberto"
              value={dataUnavailable ? 'Indisponível' : maskCurrency(summary.openValue)}
            />
            <SummaryMetric
              label="Total de baldes"
              value={dataUnavailable ? 'Indisponível' : maskNumber(summary.totalBuckets)}
            />
          </GlassCard>

          <View style={styles.purchasesTitle}>
            <Text
              style={[
                theme.typography.footnote,
                styles.purchasesTitleText,
                { color: theme.colors.textSecondary },
              ]}
            >
              Compras efetuadas
            </Text>
          </View>
          {dataUnavailable ? (
            <Text
              style={[
                theme.typography.body,
                styles.emptyStateText,
                { color: theme.colors.textSecondary },
              ]}
            >
              Dados indisponíveis sem conexão.
            </Text>
          ) : visiblePurchases.length > 0 ? (
            <View style={styles.purchaseList}>
              {visiblePurchases.map((purchase) => (
                <PurchaseRow
                  key={purchase.id}
                  onDelete={() => setPurchaseToDeleteId(purchase.id)}
                  onPress={() => {
                    router.push({
                      pathname: '/fabrica-compras/[purchaseId]',
                      params: { purchaseId: purchase.id },
                    });
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
        </>
      ) : null}
    </>
  );
  return (
    <>
      {pageTitle ? (
        <ProgressiveCollapsibleScreen
          compactTitle="Fábrica"
          contentGap={14}
          contentTopInset={originalContentTopOffset}
          largeTitle={pageTitle}
          largeTitleContainerStyle={{ marginBottom: theme.spacing.xs }}
          nativeHeader
          scrollContentContainerStyle={{ paddingBottom: 32 }}
        >
          {factoryContent}
        </ProgressiveCollapsibleScreen>
      ) : (
        <PremiumScreen
          contentContainerStyle={styles.content}
          overlayHeader={header}
          overlayHeaderSpacing={theme.spacing.md}
          progressiveBlur
          scrollViewProps={{ scrollEventThrottle: 16 }}
        >
          {pageTitleBlock}
          {factoryContent}
        </PremiumScreen>
      )}

      <ConfirmationDialog
        confirmLabel="Excluir"
        destructive
        message="Essa compra e os pagamentos vinculados serão removidos."
        onCancel={() => setPurchaseToDeleteId(null)}
        onConfirm={() => {
          if (!purchaseToDeleteId || testModeEnabled) return;
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
  const { resolvedMode, theme } = useAppTheme();
  const purchaseCardSurface = getCardSurfaceColor(resolvedMode, theme.colors.glassSurface);
  const {
    currency: maskCurrency,
    enabled: testModeEnabled,
    quantity: maskQuantity,
  } = useTestModePresentation();
  const paidAmount = factoryPurchaseCalculationService.paidAmount(purchase);
  const remainingAmount = factoryPurchaseCalculationService.remainingAmount(purchase);
  const isPaid = factoryPurchaseCalculationService.isPaid(purchase);
  const purchaseCardStyle: ViewStyle = {
    backgroundColor: purchaseCardSurface,
    borderRadius: theme.radius.xl + theme.spacing.sm,
    width: '100%',
  };
  const renderPurchaseContent = () => (
    <>
      <View style={styles.purchaseHeader}>
        <View style={styles.purchaseCopy}>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
            {formatPtBrDate(purchase.date)}
          </Text>
        </View>
        <Text
          style={[
            theme.typography.callout,
            {
              color: isPaid
                ? theme.colors.paid
                : resolvedMode === 'light'
                  ? '#000000'
                  : theme.colors.textPrimary,
            },
          ]}
        >
          {isPaid ? 'Pago' : 'Em aberto'}
        </Text>
      </View>
      <View style={[styles.purchaseDetails, { marginTop: theme.spacing.sm }]}>
        <View style={[styles.purchaseDetailsLeft, { gap: theme.spacing.xs }]}>
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            {maskQuantity(purchase.bucketQuantity)}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            Pago {maskCurrency(paidAmount)}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            Saldo {maskCurrency(remainingAmount)}
          </Text>
        </View>
      </View>
      <View style={[styles.purchaseActions, { marginTop: -theme.spacing.xs }]}>
        <NativeButton
          accessibilityLabel="Adicionar detalhes da compra"
          backgroundColor={theme.colors.contrastSurface}
          color={theme.colors.contrastContent}
          haptic="light"
          label="Adicionar"
          onPress={onPress}
          variant="filled"
        />
      </View>
    </>
  );
  return (
    <View
      style={[
        { width: '100%' },
        resolvedMode === 'dark' ? theme.shadows.none : theme.shadows.elevated,
      ]}
    >
      <View style={[styles.contextContainer, purchaseCardStyle]}>
        <NativeCardContextMenu
          actions={[
            {
              destructive: true,
              disabled: testModeEnabled,
              id: 'delete-factory-purchase',
              onPress: onDelete,
              systemImage: 'trash',
              title: 'Excluir',
            },
          ]}
          style={[styles.contextMenu, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
          preview={
            <View
              style={[
                styles.purchaseCard,
                purchaseCardStyle,
                {
                  overflow: 'hidden',
                  padding: theme.spacing.lg,
                  paddingBottom: theme.spacing.sm,
                },
              ]}
            >
              {renderPurchaseContent()}
            </View>
          }
        >
          <View
            style={[
              styles.purchaseCard,
              {
                backgroundColor: 'transparent',
                borderRadius: theme.radius.xl + theme.spacing.sm,
                padding: theme.spacing.lg,
                paddingBottom: theme.spacing.sm,
                width: '100%',
              },
            ]}
          >
            {renderPurchaseContent()}
          </View>
        </NativeCardContextMenu>
      </View>
    </View>
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
  pageTitleBlock: { width: '100%' },
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
  contextContainer: { overflow: 'hidden' },
  contextMenu: { width: '100%' },
  emptyStateText: { textAlign: 'center', width: '100%' },
  purchaseCard: { gap: 12 },
  purchaseHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  purchaseCopy: { flex: 1, gap: 4 },
  purchaseDetails: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  purchaseDetailsLeft: { alignItems: 'flex-start' },
  purchaseActions: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'flex-end' },
});
