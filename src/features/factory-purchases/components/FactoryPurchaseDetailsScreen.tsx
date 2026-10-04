import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getNativeLargeTitleStyle, NativeGlassHeader } from '@/components/layout';
import { PremiumCard, ProgressiveCollapsibleScreen } from '@/components/premium';
import { StickyActionFooter } from '@/components/premium/StickyActionFooter';
import { RetailOrderPrimaryButton } from '@/features/retail-orders/components/RetailOrderPrimaryButton';
import { useFactoryPurchaseById } from '@/hooks/useFactoryPurchases';
import { useAppSafeAreaInsets } from '@/providers';
import { factoryPurchaseCalculationService } from '@/services/factory-purchases';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import { formatPtBrDate } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

type FactoryPurchaseDetailsScreenProps = {
  purchaseId?: string;
};

export function FactoryPurchaseDetailsScreen({ purchaseId }: FactoryPurchaseDetailsScreenProps) {
  const router = useRouter();
  const purchase = useFactoryPurchaseById(purchaseId);
  const { resolvedMode, theme } = useAppTheme();
  const {
    currency: maskCurrency,
    number: maskNumber,
    enabled: testModeEnabled,
  } = useTestModePresentation();
  const insets = useAppSafeAreaInsets();
  const cardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const stickyActionFooterHeight = 58 + insets.bottom + theme.spacing.md + theme.spacing.sm;
  const contentTopInset = theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2;
  const largeTitle = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      title="Detalhes da compra"
      titleStyle={getNativeLargeTitleStyle(theme.spacing.xxs)}
    />
  );

  const handleAddPayment = useCallback(() => {
    if (!purchaseId) return;

    router.push({
      pathname: '/fabrica-compras/[purchaseId]/pagamento',
      params: { purchaseId },
    });
  }, [purchaseId, router]);

  const paidAmount = purchase ? factoryPurchaseCalculationService.paidAmount(purchase) : 0;
  const remainingAmount = purchase
    ? factoryPurchaseCalculationService.remainingAmount(purchase)
    : 0;
  const isPaid = purchase ? factoryPurchaseCalculationService.isPaid(purchase) : true;

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ProgressiveCollapsibleScreen
        compactTitle="Detalhes da compra"
        contentGap={0}
        contentTopInset={contentTopInset}
        largeTitle={largeTitle}
        largeTitleContainerStyle={{
          marginBottom: theme.spacing.xs,
          paddingHorizontal: theme.layout.screenHorizontalPadding,
        }}
        nativeHeader
        scrollContentContainerStyle={{
          paddingBottom:
            theme.layout.tabBarHeight +
            insets.bottom +
            theme.spacing.xl +
            (purchase && !isPaid ? stickyActionFooterHeight : 0),
          paddingHorizontal: 0,
        }}
      >
        <View
          style={[
            styles.content,
            {
              gap: theme.spacing.md,
              paddingHorizontal: theme.layout.screenHorizontalPadding,
              paddingTop: theme.spacing.md,
            },
          ]}
        >
          {purchase ? (
            <>
              <PremiumCard
                style={{
                  backgroundColor: cardSurface,
                  borderRadius: theme.radius.xl + theme.spacing.sm,
                  gap: theme.spacing.md,
                }}
              >
                <DetailRow label="Data" value={formatPtBrDate(purchase.date)} />
                <DetailRow label="Baldes" value={maskNumber(purchase.bucketQuantity)} />
                <DetailRow label="Valor do balde" value={maskCurrency(purchase.bucketUnitPrice)} />
                <DetailRow label="Valor total" value={maskCurrency(purchase.totalAmount)} />
                <DetailRow label="Total pago" value={maskCurrency(paidAmount)} />
                <DetailRow label="Saldo restante" value={maskCurrency(remainingAmount)} />
                <DetailRow label="Status" value={isPaid ? 'Pago' : 'Em aberto'} />
              </PremiumCard>

              <Text
                style={[
                  theme.typography.headline,
                  styles.historyTitle,
                  { color: theme.colors.textPrimary },
                ]}
              >
                Histórico de pagamentos
              </Text>
              <PremiumCard
                style={{
                  backgroundColor: cardSurface,
                  borderRadius: theme.radius.xl + theme.spacing.sm,
                  gap: theme.spacing.md,
                }}
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
              </PremiumCard>
            </>
          ) : (
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
              Compra não encontrada.
            </Text>
          )}
        </View>
      </ProgressiveCollapsibleScreen>

      {purchase && !isPaid ? (
        <StickyActionFooter height={stickyActionFooterHeight}>
          <RetailOrderPrimaryButton
            accessibilityLabel="Adicionar pagamento"
            disabled={testModeEnabled}
            label="Adicionar pagamento"
            onPress={handleAddPayment}
            preserveDisabledAppearance
          />
        </StickyActionFooter>
      ) : null}
    </View>
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
  content: { width: '100%' },
  detailRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  historyTitle: { marginTop: 0 },
  screen: { flex: 1 },
});
