import { StyleSheet, Text, View } from 'react-native';

import { PremiumCard } from '@/components/premium';
import { useAppTheme } from '@/theme';

import type { HistoryDelivery } from '@/features/history/data/historyMocks';
import { DeliveryStatusBadge } from '@/features/history/components/DeliveryStatusBadge';

export type TodayDeliveriesCardProps = {
  deliveries: readonly HistoryDelivery[];
  onToggleStatus: (deliveryId: string) => void;
};

export function TodayDeliveriesCard({ deliveries, onToggleStatus }: TodayDeliveriesCardProps) {
  const { theme } = useAppTheme();
  const totalBuckets = deliveries.reduce((total, delivery) => total + delivery.quantidadeBaldes, 0);

  if (deliveries.length === 0) return null;

  return (
    <PremiumCard
      accessibilityLabel="Entregas de hoje"
      style={[styles.card, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
    >
      <View style={styles.header}>
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
          Entregas de hoje
        </Text>
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          {`${totalBuckets} ${totalBuckets === 1 ? 'balde' : 'baldes'}`}
        </Text>
      </View>
      <View style={[styles.rows, { gap: theme.spacing.sm, marginTop: theme.spacing.md }]}>
        {deliveries.map((delivery) => (
          <View key={delivery.id} style={styles.row}>
            <View style={styles.copy}>
              <Text style={[theme.typography.callout, { color: theme.colors.textPrimary }]}>
                {delivery.cliente}
              </Text>
              <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                {`${delivery.quantidadeBaldes} ${delivery.quantidadeBaldes === 1 ? 'balde' : 'baldes'}`}
              </Text>
            </View>
            <DeliveryStatusBadge
              onPress={() => onToggleStatus(delivery.id)}
              status={delivery.status}
            />
          </View>
        ))}
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16 },
  copy: { flex: 1, gap: 2 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  row: { alignItems: 'center', flexDirection: 'row' },
  rows: { width: '100%' },
});
