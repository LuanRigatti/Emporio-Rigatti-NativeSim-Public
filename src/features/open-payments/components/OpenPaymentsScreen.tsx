import { useFocusEffect, useRouter } from 'expo-router';
import { Fragment, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeCardContextMenu, NativeGlassBackButton } from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useDeliveries } from '@/hooks/useDeliveries';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import type { Delivery } from '@/types/data';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { formatDateAsDayMonthYear, groupItemsByDate } from '@/utils/groupItemsByDate';

import type { OpenPaymentPreview } from '../data/openPaymentPreview';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(value);
}

function toOpenPaymentItem(delivery: Delivery): OpenPaymentPreview {
  return {
    amount: formatCurrency(delivery.valor),
    client: delivery.cliente,
    date: delivery.data,
    id: delivery.id,
    quantity: delivery.quantidade,
  };
}

export function OpenPaymentsScreen() {
  const router = useRouter();
  const { resolvedMode, theme } = useAppTheme();
  const { currency: maskCurrency, enabled: testModeEnabled, quantity: maskQuantity, text: maskText } =
    useTestModePresentation();
  const {
    deliveries,
    editMany,
    reload: refresh,
  } = useDeliveries({
    deliveryStatus: 'Entregue',
    mode: 'all',
    status: 'Não Pago',
  });
  const hasMountedRef = useRef(false);
  const paymentItems = useMemo(() => deliveries.map(toOpenPaymentItem), [deliveries]);
  const paymentGroups = useMemo(() => groupItemsByDate(paymentItems), [paymentItems]);
  const totalOpenAmount = useMemo(
    () => paymentItems.reduce((total, item) => total + parseCurrency(item.amount), 0),
    [paymentItems],
  );
  const renderPaymentRow = (item: OpenPaymentPreview, preview = false) => (
    <View
      style={[
        styles.cardContent,
        {
          ...(preview
            ? {
                backgroundColor: getCardSurfaceColor(resolvedMode, theme.colors.surface),
              }
            : {}),
          borderRadius: theme.radius.xl + theme.spacing.md,
          padding: theme.spacing.md,
        },
      ]}
    >
      <View style={styles.clientInfo}>
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
          {item.client}
        </Text>
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          {maskQuantity(item.quantity)}
        </Text>
      </View>
      <Text
        style={[theme.typography.body, { color: theme.colors.textPrimary, fontWeight: 'bold' }]}
      >
        {maskText(item.amount)}
      </Text>
    </View>
  );

  useFocusEffect(
    useCallback(() => {
      if (hasMountedRef.current) {
        void refresh();
      }
      hasMountedRef.current = true;
    }, [refresh]),
  );

  const handlePaymentSwipe = useCallback(
    (deliveryId: string) => {
      if (testModeEnabled) return;
      triggerLightImpactHaptic();
      void editMany([deliveryId], { status: 'Pago' });
    },
    [editMany, testModeEnabled],
  );

  const header = (
    <NativeGlassHeader
      leftActions={
        <NativeGlassBackButton
          accessibilityLabel="Voltar para Home"
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          onPress={() => router.back()}
          size={theme.sizes.iconMedium}
        />
      }
      mode="transparent"
      title="Em aberto"
    />
  );

  return (
    <PremiumScreen
      contentContainerStyle={[
        styles.screenContent,
        { gap: theme.spacing.xl, paddingBottom: theme.spacing.xxxl },
      ]}
      overlayHeader={header}
      progressiveBlur
    >
      <View style={[styles.content, { marginTop: theme.spacing.xxl }]}>
        <View style={[styles.clientList, { gap: theme.spacing.sm }]}>
          {paymentGroups.map((group) => (
            <View key={group.date} style={styles.dateGroup}>
              <Text style={[styles.groupTitle, { color: theme.colors.textSecondary }]}>
                {formatDateAsDayMonthYear(group.date)}
              </Text>
              <GlassCard
                style={[
                  styles.clientCard,
                  { borderRadius: theme.radius.xl + theme.spacing.md },
                  group.items.length > 1 ? { paddingVertical: theme.spacing.xs } : undefined,
                ]}
              >
                <View style={styles.dayItems}>
                  {group.items.map((item, index) => (
                    <Fragment key={item.id}>
                      <NativeCardContextMenu
                        actions={[
                          {
                            id: `complete-payment-${item.id}`,
                            disabled: testModeEnabled,
                            onPress: () => handlePaymentSwipe(item.id),
                            systemImage: 'checkmark.circle.fill' as const,
                            title: 'Pago',
                          },
                        ]}
                        style={[
                          styles.contextMenu,
                          { borderRadius: theme.radius.xl + theme.spacing.md },
                        ]}
                        preview={renderPaymentRow(item, true)}
                      >
                        {renderPaymentRow(item)}
                      </NativeCardContextMenu>
                      {index < group.items.length - 1 ? (
                        <View style={[styles.dividerSlot, { height: theme.spacing.lg }]}>
                          <View
                            style={[
                              styles.divider,
                              {
                                backgroundColor: theme.colors.separator,
                                marginHorizontal: theme.sizes.iconSmall + theme.spacing.sm,
                              },
                            ]}
                          />
                        </View>
                      ) : null}
                    </Fragment>
                  ))}
                </View>
              </GlassCard>
            </View>
          ))}
          <Text
            style={[
              theme.typography.body,
              styles.totalAmount,
              { color: theme.colors.textPrimary, fontWeight: '700' },
            ]}
          >
            {maskCurrency(totalOpenAmount)}
          </Text>
        </View>
      </View>
    </PremiumScreen>
  );
}

function parseCurrency(value: string): number {
  const normalized = value
    .replace(/R\$\s?/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

const styles = StyleSheet.create({
  screenContent: { flexGrow: 1 },
  content: { gap: 24 },
  clientList: { width: '100%' },
  clientCard: { paddingHorizontal: 16, paddingVertical: 14, width: '100%' },
  cardContent: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  clientInfo: { gap: 2 },
  contextMenu: { width: '100%' },
  dateGroup: { gap: 10 },
  dayItems: { width: '100%' },
  groupTitle: { marginLeft: 12 },
  totalAmount: { alignSelf: 'center' },
  divider: { height: StyleSheet.hairlineWidth },
  dividerSlot: { justifyContent: 'center', width: '100%' },
});
