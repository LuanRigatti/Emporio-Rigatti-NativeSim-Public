import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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

  return (
    <PremiumScreen
      contentContainerStyle={[
        styles.screenContent,
        { gap: theme.spacing.xl, paddingBottom: theme.spacing.xxxl },
      ]}
    >
      <View style={styles.header}>
        <NativeGlassBackButton
          accessibilityLabel="Voltar para Home"
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          onPress={() => router.back()}
          size={theme.sizes.iconMedium}
        />
        <View pointerEvents="none" style={styles.headerCopy}>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            Notas fiscais/boletos
          </Text>
        </View>
        <NativeGlassIconButton
          accessibilityLabel={isSelectionMode ? 'Confirmar notas emitidas' : 'Selecionar notas'}
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          fallbackIcon="checkmark"
          interactiveGlass
          onPress={handleCheckPress}
          size={theme.sizes.iconMedium}
          systemImage="checkmark"
        />
      </View>
      {invoiceItems.length > 0 ? (
        <View style={styles.clientList}>
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
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
  },
  headerCopy: { alignItems: 'center', left: 0, position: 'absolute', right: 0 },
  clientList: { width: '100%' },
  clientCard: { padding: 16 },
});
