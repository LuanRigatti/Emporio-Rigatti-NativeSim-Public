import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { getNativeLargeTitleStyle, NativeGlassHeader } from '@/components/layout';
import { NativeDatePicker, NativeTextField } from '@/components/native';
import { PremiumCard, ProgressiveCollapsibleScreen } from '@/components/premium';
import { StickyActionFooter } from '@/components/premium/StickyActionFooter';
import { RetailOrderPrimaryButton } from '@/features/retail-orders/components/RetailOrderPrimaryButton';
import { useAppSafeAreaInsets } from '@/providers';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import { normalizeMoney, todayIso } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

type FactoryPurchasePaymentScreenProps = {
  purchaseId?: string;
  onAddPayment: (purchaseId: string, payment: { date: string; amount: number }) => Promise<unknown>;
};

export function FactoryPurchasePaymentScreen({
  onAddPayment,
  purchaseId,
}: FactoryPurchasePaymentScreenProps) {
  const router = useRouter();
  const { resolvedMode, theme } = useAppTheme();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const insets = useAppSafeAreaInsets();
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [paymentAmount, setPaymentAmount] = useState('');
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const cardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const stickyActionFooterHeight = 58 + insets.bottom + theme.spacing.md + theme.spacing.sm;
  const contentTopInset = theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2;
  const largeTitle = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      title="Novo pagamento"
      titleStyle={getNativeLargeTitleStyle(theme.spacing.xxs)}
    />
  );

  const handleSubmit = useCallback(async () => {
    if (testModeEnabled || isSubmittingRef.current) return;
    if (!purchaseId) {
      setError('Compra não encontrada.');
      return;
    }

    const amount = normalizeMoney(paymentAmount);
    if (amount === undefined) {
      setError('Informe um valor de pagamento maior que zero.');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(undefined);
    Keyboard.dismiss();

    try {
      await onAddPayment(purchaseId, { amount, date: todayIso(paymentDate) });
      router.back();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível adicionar o pagamento.',
      );
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [onAddPayment, paymentAmount, paymentDate, purchaseId, router, testModeEnabled]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ProgressiveCollapsibleScreen
        compactTitle="Novo pagamento"
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
            theme.layout.tabBarHeight + insets.bottom + theme.spacing.xl + stickyActionFooterHeight,
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
          {error ? (
            <Text
              accessibilityRole="alert"
              style={[theme.typography.footnote, { color: theme.colors.danger }]}
            >
              {error}
            </Text>
          ) : null}

          <PremiumCard
            style={{
              backgroundColor: cardSurface,
              borderRadius: theme.radius.xl + theme.spacing.sm,
              gap: theme.spacing.md,
            }}
          >
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
              Pagamento
            </Text>
            <View style={styles.dateRow}>
              <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>Data</Text>
              <NativeDatePicker
                accessibilityLabel="Data do pagamento"
                mode="date"
                onChange={(value) => {
                  setPaymentDate(value);
                  setError(undefined);
                }}
                style="compact"
                value={paymentDate}
              />
            </View>
            <NativeTextField
              accessibilityLabel="Valor pago"
              disabled={testModeEnabled || isSubmitting}
              keyboardType="decimal-pad"
              label="Valor pago"
              onChangeText={(value) => {
                setPaymentAmount(value);
                setError(undefined);
              }}
              placeholder="R$ 0,00"
              value={paymentAmount}
            />
          </PremiumCard>
        </View>
      </ProgressiveCollapsibleScreen>
      <StickyActionFooter height={stickyActionFooterHeight}>
        <RetailOrderPrimaryButton
          accessibilityLabel="Adicionar pagamento"
          disabled={testModeEnabled || isSubmitting || !purchaseId}
          label="Adicionar"
          onPress={handleSubmit}
          preserveDisabledAppearance
        />
      </StickyActionFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%' },
  dateRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  screen: { flex: 1 },
});
