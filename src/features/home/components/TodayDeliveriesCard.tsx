import { StyleSheet, Text, View } from 'react-native';

import { NativeCardContextMenu } from '@/components/native';
import { PremiumCard } from '@/components/premium';
import { useAppTheme } from '@/theme';

import type { HistoryDelivery } from '@/features/history/data/historyMocks';
import { DeliveryStatusBadge } from '@/features/history/components/DeliveryStatusBadge';

export type TodayDeliveriesCardProps = {
  deliveries: readonly HistoryDelivery[];
  onDelete: (deliveryId: string) => void;
  onToggleStatus: (deliveryId: string) => void;
};

export function TodayDeliveriesCard({
  deliveries,
  onDelete,
  onToggleStatus,
}: TodayDeliveriesCardProps) {
  const { theme } = useAppTheme();
  const totalBuckets = deliveries.reduce((total, delivery) => total + delivery.quantidadeBaldes, 0);

  if (deliveries.length === 0) return null;

  return (
    <View style={[styles.container, { gap: theme.spacing.md }]}>
      <View style={styles.header}>
        <Text
          style={[theme.typography.headline, styles.title, { color: theme.colors.textPrimary }]}
        >
          Entregas de hoje
        </Text>
        <Text
          style={[
            theme.typography.footnote,
            styles.quantity,
            { color: theme.colors.textSecondary },
          ]}
        >
          {`${totalBuckets} ${totalBuckets === 1 ? 'balde' : 'baldes'}`}
        </Text>
      </View>

      <PremiumCard style={[styles.card, { borderRadius: theme.radius.xl + theme.spacing.sm }]}>
        <View style={{ gap: theme.spacing.xs }}>
          {deliveries.map((delivery) => (
            <NativeCardContextMenu
              actions={[
                {
                  destructive: true,
                  id: 'delete-delivery',
                  onPress: () => onDelete(delivery.id),
                  systemImage: 'trash',
                  title: 'Excluir',
                },
              ]}
              key={delivery.id}
              style={{ width: '100%' }}
            >
              <View style={[styles.row, { padding: theme.spacing.md }]}>
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
            </NativeCardContextMenu>
          ))}
        </View>
      </PremiumCard>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0 },
  copy: { flex: 1, gap: 2, marginLeft: 8 },
  container: { width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  quantity: { marginRight: 16 },
  row: { alignItems: 'center', flexDirection: 'row' },
  title: { marginLeft: 16 },
});
