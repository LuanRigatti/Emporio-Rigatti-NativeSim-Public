import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeGlassBackButton,
  NativeSwipeActionsList,
  type NativeSwipeActionsListItem,
} from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import { openPaymentPreview } from '@/features/open-payments/data/openPaymentPreview';

export function InvoicesScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const [invoiceItems, setInvoiceItems] = useState(() => [...openPaymentPreview]);

  const nativeInvoiceItems = useMemo<NativeSwipeActionsListItem[]>(
    () =>
      invoiceItems.map((item) => ({
        id: item.client,
        overline: item.date,
        subtitle: `${item.quantity} ${item.quantity === 1 ? 'balde' : 'baldes'}`,
        title: item.client,
        trailingSystemImage: 'exclamationmark.circle',
        trailingSystemImageColor: theme.colors.warning,
        trailingText: item.amount,
      })),
    [invoiceItems, theme.colors.warning],
  );

  const handleInvoiceSwipe = useCallback((client: string) => {
    triggerLightImpactHaptic();
    setInvoiceItems((current) => current.filter((item) => item.client !== client));
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

const styles = StyleSheet.create({
  screenContent: { flexGrow: 1 },
  clientList: { width: '100%' },
  clientCard: { padding: 16 },
});
