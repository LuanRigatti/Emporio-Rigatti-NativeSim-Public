import { StyleSheet, Text, View } from 'react-native';

import { NativeCardContextMenu } from '@/components/native';
import { PremiumCard } from '@/components/premium';
import { useAppTheme } from '@/theme';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

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
  const { enabled: testModeEnabled, quantity: maskQuantity } = useTestModePresentation();
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
          {maskQuantity(totalBuckets)}
        </Text>
      </View>

      <PremiumCard style={[styles.card, { borderRadius: theme.radius.xl + theme.spacing.sm }]}>
        <View style={{ gap: theme.spacing.xs }}>
          {deliveries.map((delivery) => {
            const renderDeliveryRow = (preview = false) => (
              <View
                style={[
                  styles.row,
                  {
                    backgroundColor: preview ? theme.colors.surface : 'transparent',
                    borderRadius: theme.radius.xl + theme.spacing.sm,
                    overflow: preview ? 'hidden' : undefined,
                    padding: theme.spacing.md,
                    width: '100%',
                  },
                ]}
              >
                <View style={styles.copy}>
                  <Text
                    style={[
                      theme.typography.callout,
                      { color: theme.colors.textPrimary, fontWeight: 'bold' },
                    ]}
                  >
                    {delivery.cliente}
                  </Text>
                  <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                    {maskQuantity(delivery.quantidadeBaldes)}
                  </Text>
                </View>
                <DeliveryStatusBadge
                  disabled={testModeEnabled}
                  onPress={() => onToggleStatus(delivery.id)}
                  status={delivery.status}
                />
              </View>
            );

            return (
              <View
                key={delivery.id}
                style={[
                  styles.contextContainer,
                  {
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radius.xl + theme.spacing.sm,
                    overflow: 'hidden',
                    width: '100%',
                  },
                ]}
              >
                <NativeCardContextMenu
                  actions={[
                    {
                      destructive: true,
                      disabled: testModeEnabled,
                      id: 'delete-delivery',
                      onPress: () => onDelete(delivery.id),
                      systemImage: 'trash',
                      title: 'Excluir',
                    },
                  ]}
                  preview={renderDeliveryRow(true)}
                  style={[styles.contextMenu, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
                >
                  {renderDeliveryRow()}
                </NativeCardContextMenu>
              </View>
            );
          })}
        </View>
      </PremiumCard>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', padding: 0 },
  contextContainer: { overflow: 'hidden' },
  contextMenu: { width: '100%' },
  copy: { flex: 1, gap: 2, marginLeft: 8 },
  container: { width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  quantity: { marginRight: 16 },
  row: { alignItems: 'center', flexDirection: 'row', width: '100%' },
  title: { marginLeft: 16 },
});
