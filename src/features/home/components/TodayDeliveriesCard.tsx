import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

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
  const { reduceMotionEnabled, theme } = useAppTheme();
  const { enabled: testModeEnabled, quantity: maskQuantity } = useTestModePresentation();
  const totalBuckets = deliveries.reduce((total, delivery) => total + delivery.quantidadeBaldes, 0);
  const isEmpty = deliveries.length === 0;
  const emptyDeliveryCardMinHeight = theme.spacing.xxl * 10;
  const transitionDuration = reduceMotionEnabled ? 0 : theme.animations.duration.standard;
  const contentLayoutTransition = LinearTransition.duration(transitionDuration);

  return (
    <View
      style={[
        styles.container,
        {
          gap: isEmpty ? theme.spacing.sm : theme.spacing.md,
          marginTop: isEmpty ? -theme.spacing.xs : 0,
        },
      ]}
    >
      <View style={styles.header}>
        <Text
          style={[theme.typography.headline, styles.title, { color: theme.colors.textPrimary }]}
        >
          Entregas de hoje
        </Text>
        {deliveries.length > 0 ? (
          <Text
            style={[
              theme.typography.footnote,
              styles.quantity,
              { color: theme.colors.textSecondary },
            ]}
          >
            {maskQuantity(totalBuckets)}
          </Text>
        ) : null}
      </View>

      <Animated.View layout={contentLayoutTransition} style={styles.transitionContent}>
        {isEmpty ? (
          <Animated.View
            entering={FadeIn.duration(transitionDuration)}
            exiting={FadeOut.duration(transitionDuration)}
            key="empty-deliveries"
            layout={contentLayoutTransition}
            style={styles.transitionContent}
          >
            <PremiumCard
              style={[
                styles.emptyDeliveryCard,
                {
                  borderRadius: theme.radius.xl + theme.spacing.lg,
                  minHeight: emptyDeliveryCardMinHeight,
                  paddingVertical: theme.spacing.xxl * 2,
                },
              ]}
            >
              <View style={styles.emptyStateCard}>
                <Text
                  style={[
                    theme.typography.body,
                    { color: theme.colors.textSecondary, textAlign: 'center' },
                  ]}
                >
                  Nenhuma entrega hoje
                </Text>
              </View>
            </PremiumCard>
          </Animated.View>
        ) : (
          <Animated.View
            entering={FadeIn.duration(transitionDuration)}
            exiting={FadeOut.duration(transitionDuration)}
            key="today-deliveries"
            layout={contentLayoutTransition}
            style={styles.transitionContent}
          >
            <View style={[styles.cards, { gap: theme.spacing.xs }]}>
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
                      <Text
                        style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
                      >
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
                  <Animated.View
                    entering={FadeIn.duration(transitionDuration)}
                    exiting={FadeOut.duration(transitionDuration)}
                    key={delivery.id}
                    layout={contentLayoutTransition}
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
                      style={[
                        styles.contextMenu,
                        { borderRadius: theme.radius.xl + theme.spacing.sm },
                      ]}
                    >
                      {renderDeliveryRow()}
                    </NativeCardContextMenu>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cards: { width: '100%' },
  contextContainer: { overflow: 'hidden' },
  contextMenu: { width: '100%' },
  copy: { flex: 1, gap: 2, marginLeft: 8 },
  container: { width: '100%' },
  emptyDeliveryCard: { width: '100%' },
  emptyStateCard: { alignItems: 'center', flex: 1, justifyContent: 'center', width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  quantity: { marginRight: 16 },
  row: { alignItems: 'center', flexDirection: 'row', width: '100%' },
  title: { marginLeft: 16 },
  transitionContent: { width: '100%' },
});
