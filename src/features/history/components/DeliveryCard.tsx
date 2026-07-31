import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/premium';
import { useAppTheme } from '@/theme';

import type { HistoryDelivery } from '../data/historyMocks';
import { DeliveryLocationActions } from './DeliveryLocationActions';
import { DeliveryStatusBadge } from './DeliveryStatusBadge';

export type DeliveryCardProps = {
  delivery: HistoryDelivery;
  onOpenAppleMaps: () => void;
  onOpenWaze: () => void;
  onToggleStatus: () => void;
};

function statusLabel(status: HistoryDelivery['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function DeliveryCard({
  delivery,
  onOpenAppleMaps,
  onOpenWaze,
  onToggleStatus,
}: DeliveryCardProps) {
  const { resolvedMode, theme } = useAppTheme();

  return (
    <GlassCard
      accessibilityLabel={`Entrega para ${delivery.cliente}, ${statusLabel(delivery.status)}`}
      style={[
        styles.card,
        theme.shadows.card,
        {
          backgroundColor: resolvedMode === 'dark' ? theme.colors.surfaceElevated : '#FFFFFF',
          borderWidth: 0,
          borderRadius: theme.radius.xl + theme.spacing.sm,
        },
      ]}
    >
      <View style={styles.cardRow}>
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.clientCopy}>
              <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                {delivery.cliente}
              </Text>
            </View>
            <DeliveryStatusBadge onPress={onToggleStatus} status={delivery.status} />
            <DeliveryLocationActions
              customerName={delivery.cliente}
              onOpenAppleMaps={onOpenAppleMaps}
              onOpenWaze={onOpenWaze}
            />
          </View>

          <View style={[styles.primaryInfo, { gap: theme.spacing.sm, marginTop: 4 }]}>
            <Text style={[theme.typography.callout, { color: theme.colors.textPrimary }]}>
              {delivery.quantidadeBaldes} baldes
            </Text>
            <Text style={[theme.typography.callout, { color: theme.colors.textPrimary }]}>
              {delivery.valor}
            </Text>
          </View>

          <View style={[styles.secondaryInfo, { gap: theme.spacing.sm }]}>
            <View style={styles.secondaryItem}>
              <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                {delivery.formaPagamento}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14 },
  cardRow: { alignItems: 'stretch', flexDirection: 'row', gap: 10 },
  cardContent: { flex: 1, gap: 8 },
  cardHeader: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  clientCopy: { flex: 1 },
  primaryInfo: { flexDirection: 'row', justifyContent: 'space-between' },
  secondaryInfo: { flexDirection: 'row', flexWrap: 'wrap' },
  secondaryItem: { alignItems: 'center', flexDirection: 'row', gap: 4 },
});
