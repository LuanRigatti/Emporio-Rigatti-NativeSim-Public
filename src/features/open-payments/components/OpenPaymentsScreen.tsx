import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeGlassBackButton,
  NativeSwipeActionsList,
} from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useAppTheme } from '@/theme';
import type { Delivery } from '@/types/data';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import {
  formatDateAsDayMonthYear,
  groupItemsByDate,
} from '@/utils/groupItemsByDate';

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
  } = useDeliveries({ mode: 'all', status: 'Não Pago' });
  const hasMountedRef = useRef(false);
  const paymentItems = useMemo(
    () =>
      deliveries.map(toOpenPaymentItem),
    [deliveries],
  );
  const paymentGroups = useMemo(() => groupItemsByDate(paymentItems), [paymentItems]);

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
              <GlassCard
                style={[styles.clientCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
              >
                <NativeSwipeActionsList
                action={{
                  label: 'Concluído',
                  systemImage: 'checkmark.circle.fill',
                  tint: theme.colors.success,
                }}
                colors={{
                  border: theme.colors.borderStrong,
                  selectionContent: theme.colors.selectionContent,
                  selectionSurface: theme.colors.selectionSurface,
                  textPrimary: theme.colors.textPrimary,
                  textSecondary: theme.colors.textSecondary,
                }}
                items={group.items.map((item) => ({
                  id: item.id,
                  subtitle: `${item.quantity} ${item.quantity === 1 ? 'balde' : 'baldes'}`,
                  title: item.client,
                  titleBold: true,
                  trailingText: item.amount,
                }))}
                  compact
                  onDelete={handlePaymentSwipe}
                  trailingValueAlignment="top"
                />
              </GlassCard>
            </View>
          ))}
          <GlassCard
            style={[styles.totalCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
          >
            <View style={styles.totalRow}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                TOTAL EM ABERTO
              </Text>
              <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                {formatCurrency(
                  paymentItems.reduce((total, item) => total + parseCurrency(item.amount), 0),
                )}
              </Text>
            </View>
          </GlassCard>
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
  clientCard: { paddingHorizontal: 16, paddingVertical: 0 },
  dateGroup: { gap: 10 },
  groupTitle: { marginLeft: 12 },
  totalCard: { padding: 16 },
  totalRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
