import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeGlassBackButton,
  NativeSwipeActionsList,
  type NativeSwipeActionsListItem,
} from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useAppData } from '@/hooks/useAppData';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import type { OpenPaymentPreview } from '@/features/open-payments/data/openPaymentPreview';

export function InvoicesScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { refresh, snapshot } = useAppData();
  const [hiddenInvoiceIds, setHiddenInvoiceIds] = useState<ReadonlySet<string>>(new Set());
  const invoiceItems = useMemo<OpenPaymentPreview[]>(
    () =>
      (snapshot?.entregas ?? [])
        .filter((delivery) => delivery.invoiceStatus && !hiddenInvoiceIds.has(delivery.id))
        .map((delivery) => ({
          amount: formatCurrency(delivery.valor),
          client: delivery.cliente,
          date: delivery.data,
          id: delivery.id,
          quantity: delivery.quantidade,
        })),
    [hiddenInvoiceIds, snapshot],
  );

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const nativeInvoiceItems = useMemo<NativeSwipeActionsListItem[]>(
    () =>
      invoiceItems.map((item) => ({
        id: item.id,
        overline: item.date,
        subtitle: `${item.quantity} ${item.quantity === 1 ? 'balde' : 'baldes'}`,
        title: item.client,
        trailingSystemImage: 'exclamationmark.circle',
        trailingSystemImageColor: theme.colors.warning,
        trailingText: item.amount,
      })),
    [invoiceItems, theme.colors.warning],
  );

  const handleInvoiceSwipe = useCallback((deliveryId: string) => {
    triggerLightImpactHaptic();
    setHiddenInvoiceIds((current) => new Set(current).add(deliveryId));
  }, []);

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
      {invoiceItems.length > 0 ? (
        <View style={[styles.clientList, { marginTop: theme.spacing.xxl }]}>
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
              items={nativeInvoiceItems}
              onDelete={handleInvoiceSwipe}
              trailingValueAlignment="top"
            />
          </GlassCard>
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
});
