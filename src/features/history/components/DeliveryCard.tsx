import { StyleSheet, Text, View } from 'react-native';

import { NativeCardContextMenu } from '@/components/native';
import { GlassCard } from '@/components/premium';
import { useAppTheme } from '@/theme';
import { formatPtBrDate } from '@/utils/data';

import type { HistoryDelivery } from '../data/historyMocks';
import { DeliveryStatusBadge } from './DeliveryStatusBadge';

export type DeliveryCardProps = {
  delivery: HistoryDelivery;
  onToggleStatus: () => void;
  onDelete?: () => void;
};

function statusLabel(status: HistoryDelivery['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function DeliveryCard({ delivery, onDelete, onToggleStatus }: DeliveryCardProps) {
  const { resolvedMode, theme } = useAppTheme();

  const card = (
    <GlassCard
      accessibilityLabel={`Entrega para ${delivery.cliente}, ${statusLabel(delivery.status)}`}
      style={[
        styles.card,
        {
          backgroundColor: resolvedMode === 'dark' ? theme.colors.surfaceElevated : '#FFFFFF',
          borderWidth: 0,
          borderRadius: theme.radius.xl + theme.spacing.sm,
          marginHorizontal: theme.spacing.xs,
        },
      ]}
    >
      <View style={styles.cardRow}>
        <View style={styles.cardContent}>
          <View style={styles.cardDateRow}>
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
              {formatPtBrDate(delivery.data)}
            </Text>
            <DeliveryStatusBadge onPress={onToggleStatus} status={delivery.status} />
          </View>

          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            {delivery.cliente}
          </Text>

          <View style={[styles.primaryInfo, { gap: theme.spacing.sm }]}>
            <Text style={[theme.typography.callout, { color: theme.colors.textPrimary }]}>
              {delivery.quantidadeBaldes} baldes
            </Text>
            <Text style={[theme.typography.callout, { color: theme.colors.textPrimary }]}>
              {delivery.valor}
            </Text>
          </View>
        </View>
      </View>
    </GlassCard>
  );

  return onDelete ? (
    <NativeCardContextMenu
      actions={[
        {
          destructive: true,
          id: 'delete-delivery',
          onPress: onDelete,
          systemImage: 'trash',
          title: 'Excluir',
        },
      ]}
    >
      {card}
    </NativeCardContextMenu>
  ) : (
    card
  );
}

const styles = StyleSheet.create({
  card: { padding: 14 },
  cardRow: { alignItems: 'stretch', flexDirection: 'row', gap: 10 },
  cardContent: { flex: 1, gap: 8 },
  cardDateRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  primaryInfo: { flexDirection: 'row', justifyContent: 'space-between' },
});
