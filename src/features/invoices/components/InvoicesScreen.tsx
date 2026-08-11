import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeGlassBackButton,
  NativeSwipeActionsList,
} from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useClients } from '@/hooks/useClients';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import {
  formatDateAsDayMonthYear,
  groupItemsByDate,
} from '@/utils/groupItemsByDate';

import type { OpenPaymentPreview } from '@/features/open-payments/data/openPaymentPreview';

export function InvoicesScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { clients, reload: reloadClients } = useClients();
  const eligibleClientIds = useMemo(
    () => clients.filter((client) => client.usesInvoice).map((client) => client.clientId),
    [clients],
  );
  const { deliveries, reload: reloadDeliveries, updateInvoiceStatus } = useDeliveries({
    clientIds: eligibleClientIds,
    mode: 'all',
  });
  const invoiceItems = useMemo<OpenPaymentPreview[]>(
    () =>
      deliveries
        .filter((delivery) => delivery.invoiceStatus === 'a_emitir')
        .map((delivery) => ({
          amount: formatCurrency(delivery.valor),
          client: delivery.cliente,
          date: delivery.data,
          id: delivery.id,
          quantity: delivery.quantidade,
        })),
    [deliveries],
  );
  const invoiceGroups = useMemo(() => groupItemsByDate(invoiceItems), [invoiceItems]);

  useFocusEffect(
    useCallback(() => {
      void reloadClients();
      void reloadDeliveries();
    }, [reloadClients, reloadDeliveries]),
  );

  const handleInvoiceSwipe = useCallback(
    async (deliveryId: string) => {
      triggerLightImpactHaptic();
      await updateInvoiceStatus(deliveryId, 'emitido');
    },
    [updateInvoiceStatus],
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
      title="Notas fiscais/boletos"
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
      {invoiceGroups.length > 0 ? (
        <View style={[styles.clientList, { gap: theme.spacing.md, marginTop: theme.spacing.xxl }]}>
          {invoiceGroups.map((group) => (
            <View key={group.date} style={styles.dateGroup}>
              <Text style={[styles.groupTitle, { color: theme.colors.textSecondary }]}>
                {formatDateAsDayMonthYear(group.date)}
              </Text>
              <GlassCard
                style={[styles.clientCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
              >
                <NativeSwipeActionsList
                action={{
                  label: 'Emitido',
                  systemImage: 'checkmark.seal.fill',
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
                  trailingSystemImage: 'exclamationmark.circle',
                  trailingSystemImageColor: theme.colors.warning,
                  trailingText: item.amount,
                }))}
                  compact
                  onDelete={handleInvoiceSwipe}
                  trailingValueAlignment="top"
                />
              </GlassCard>
            </View>
          ))}
        </View>
      ) : null}
    </PremiumScreen>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(value);
}

const styles = StyleSheet.create({
  screenContent: { flexGrow: 1 },
  clientList: { width: '100%' },
  clientCard: { padding: 16 },
  dateGroup: { gap: 6 },
  groupTitle: { marginLeft: 4 },
});
