import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeGlassBackButton, NativeGlassIconButton } from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import { OpenPaymentRow } from '@/features/open-payments/components/OpenPaymentRow';
import { openPaymentPreview } from '@/features/open-payments/data/openPaymentPreview';

export function InvoicesScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const [invoiceItems, setInvoiceItems] = useState(() => [...openPaymentPreview]);
  const [isSelectionMode, setSelectionMode] = useState(false);
  const [selectedClients, setSelectedClients] = useState<ReadonlySet<string>>(() => new Set());

  const handleCheckPress = useCallback(() => {
    triggerLightImpactHaptic();

    if (!isSelectionMode) {
      setSelectedClients(new Set());
      setSelectionMode(true);
      return;
    }

    setInvoiceItems((current) => current.filter((item) => !selectedClients.has(item.client)));
    setSelectedClients(new Set());
    setSelectionMode(false);
  }, [isSelectionMode, selectedClients]);

  const toggleClientSelection = useCallback((client: string) => {
    setSelectedClients((current) => {
      const next = new Set(current);
      if (next.has(client)) {
        next.delete(client);
      } else {
        next.add(client);
      }
      return next;
    });
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
      rightActions={
        <NativeGlassIconButton
          accessibilityLabel={isSelectionMode ? 'Confirmar notas emitidas' : 'Selecionar notas'}
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          fallbackIcon={isSelectionMode ? 'checkmark' : 'ellipsis-horizontal'}
          interactiveGlass
          onPress={handleCheckPress}
          size={theme.sizes.iconMedium}
          systemImage={isSelectionMode ? 'checkmark' : 'ellipsis'}
        />
      }
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
            {invoiceItems.map((item) => (
              <View key={item.client}>
                <OpenPaymentRow
                  item={item}
                  onPress={isSelectionMode ? () => toggleClientSelection(item.client) : undefined}
                  selected={selectedClients.has(item.client)}
                  selectionMode={isSelectionMode}
                  showInvoiceStatusIcon
                />
              </View>
            ))}
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
