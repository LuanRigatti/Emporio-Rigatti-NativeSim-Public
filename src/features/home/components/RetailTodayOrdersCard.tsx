import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/feedback';
import { AnimatedPressable, PremiumCard } from '@/components/premium';
import { useAppTheme } from '@/theme';
import type { RetailOrder } from '@/types/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

export type RetailTodayOrdersCardProps = {
  cardSurfaceColor?: string;
  orders: readonly RetailOrder[];
  onOrderPress: (orderId: string) => void;
};

export function RetailTodayOrdersCard({
  cardSurfaceColor,
  onOrderPress,
  orders,
}: RetailTodayOrdersCardProps) {
  const { theme } = useAppTheme();
  const { currency: maskCurrency } = useTestModePresentation();
  const surfaceColor = cardSurfaceColor ?? theme.colors.surface;

  return (
    <View style={[styles.container, { gap: theme.spacing.md }]}>
      <View style={styles.header}>
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
          Entregas de hoje
        </Text>
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          {orders.length}
        </Text>
      </View>
      <PremiumCard
        style={[
          styles.card,
          {
            backgroundColor: surfaceColor,
            borderRadius: theme.radius.xl + theme.spacing.sm,
            padding: theme.spacing.sm,
          },
        ]}
      >
        <View style={{ gap: theme.spacing.xs }}>
          {orders.map((order) => {
            const detail = [order.recipient?.trim(), order.occasion?.trim()]
              .filter(Boolean)
              .join(' · ');
            const secondary = detail || order.deliveryAddressSnapshot;
            return (
              <AnimatedPressable
                accessibilityLabel={`Abrir pedido de ${order.clientNameSnapshot}`}
                accessibilityRole="button"
                key={order.orderId}
                onPress={() => onOrderPress(order.orderId)}
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.72 : 1 }]}
              >
                <View
                  style={[
                    styles.icon,
                    {
                      backgroundColor: theme.colors.background,
                      borderRadius: theme.radius.pill,
                    },
                  ]}
                >
                  <Ionicons color={theme.colors.textSecondary} name="cube-outline" size={21} />
                </View>
                <View style={[styles.copy, { gap: theme.spacing.xxs }]}>
                  <Text
                    numberOfLines={1}
                    style={[theme.typography.body, { color: theme.colors.textPrimary }]}
                  >
                    {order.clientNameSnapshot}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
                  >
                    {secondary}
                  </Text>
                </View>
                <View style={[styles.trailing, { gap: theme.spacing.xxs }]}>
                  <Text style={[theme.typography.footnote, { color: theme.colors.textPrimary }]}>
                    {maskCurrency(order.totalCharged)}
                  </Text>
                  <Badge label={operationalStatusLabel(order.status)} tone="warning" />
                </View>
              </AnimatedPressable>
            );
          })}
        </View>
      </PremiumCard>
    </View>
  );
}

function operationalStatusLabel(status: RetailOrder['status']): string {
  if (status === 'completed') return 'Concluído';
  return 'Em aberto';
}

const styles = StyleSheet.create({
  card: { width: '100%' },
  container: { width: '100%' },
  copy: { flex: 1, minWidth: 0 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  icon: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 66, padding: 8 },
  trailing: { alignItems: 'flex-end' },
});
