import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeCardContextMenu, NativeGlassBackButton } from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useAppTheme } from '@/theme';
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
  const { theme } = useAppTheme();
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
      triggerLightImpactHaptic();
      void editMany([deliveryId], { status: 'Pago' });
    },
    [editMany],
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
      title="Recebimentos em aberto"
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
              <NativeCardContextMenu
                actions={group.items.map((item) => ({
                  id: `complete-payment-${item.id}`,
                  onPress: () => handlePaymentSwipe(item.id),
                  systemImage: 'checkmark.circle.fill' as const,
                  title: `Concluído — ${item.client}`,
                }))}
                style={[styles.contextMenu, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
              >
                <GlassCard
                  style={[styles.clientCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
                >
                  <View style={[styles.dayItems, { gap: theme.spacing.lg }]}>
                    {group.items.map((item) => (
                      <View key={item.id} style={styles.cardContent}>
                        <View style={styles.clientInfo}>
                          <Text
                            style={[theme.typography.body, { color: theme.colors.textPrimary }]}
                          >
                            {item.client}
                          </Text>
                          <Text
                            style={[
                              theme.typography.footnote,
                              { color: theme.colors.textSecondary },
                            ]}
                          >
                            {`${item.quantity} ${item.quantity === 1 ? 'balde' : 'baldes'}`}
                          </Text>
                        </View>
                        <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                          {item.amount}
                        </Text>
                      </View>
                    ))}
                  </View>
                </GlassCard>
              </NativeCardContextMenu>
            </View>
          ))}
          <Text
            style={[
              theme.typography.body,
              styles.totalAmount,
              { color: theme.colors.textPrimary, fontWeight: '700' },
            ]}
          >
            {formatCurrency(totalOpenAmount)}
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
});
