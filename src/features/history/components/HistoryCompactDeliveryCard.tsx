import { StyleSheet, Text, View } from 'react-native';

import { NativeCardContextMenu } from '@/components/native';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type { HistoryDelivery } from '../data/historyMocks';

export type HistoryCompactDeliveryCardProps = {
  delivery: HistoryDelivery;
  onDelete: () => void;
  onMarkDelivered?: () => void;
};

export function HistoryCompactDeliveryCard({
  delivery,
  onDelete,
  onMarkDelivered,
}: HistoryCompactDeliveryCardProps) {
  const { resolvedMode, theme } = useAppTheme();
  const cardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surfaceMuted);
  const { enabled: testModeEnabled, quantity: maskQuantity } = useTestModePresentation();
  const statusColor = delivery.status === 'concluída' ? theme.colors.success : theme.colors.warning;
  const radius = theme.radius.card;
  const cardHeight = Math.max(
    theme.sizes.touchTargetMinimum,
    theme.typography.footnote.lineHeight * 2 + theme.spacing.xxs * 2,
  );
  const card = (preview: boolean) => (
    <View
      accessible
      accessibilityLabel={`${delivery.cliente}, ${maskQuantity(delivery.quantidadeBaldes)}`}
      style={[
        styles.card,
        {
          backgroundColor: preview ? cardSurface : 'transparent',
          borderRadius: radius,
          height: cardHeight,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xxs,
        },
      ]}
    >
      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      <View style={[styles.clientDetails, { marginLeft: theme.spacing.xs }]}>
        <Text
          numberOfLines={1}
          style={[theme.typography.footnote, { color: theme.colors.textPrimary }]}
        >
          {delivery.cliente}
        </Text>
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          {maskQuantity(delivery.quantidadeBaldes)}
        </Text>
      </View>
    </View>
  );

  return (
    <View
      style={[
        styles.shadow,
        {
          borderRadius: radius,
          height: cardHeight,
        },
        resolvedMode === 'dark' ? theme.shadows.none : theme.shadows.card,
      ]}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: cardSurface,
            borderRadius: radius,
            height: cardHeight,
          },
        ]}
      >
        <NativeCardContextMenu
          actions={[
            ...(delivery.status === 'pendente' && onMarkDelivered
              ? [
                  {
                    disabled: testModeEnabled,
                    id: `complete-history-delivery-${delivery.id}`,
                    onPress: onMarkDelivered,
                    systemImage: 'checkmark.circle.fill' as const,
                    title: 'Concluída',
                  },
                ]
              : []),
            {
              destructive: true,
              disabled: testModeEnabled,
              id: `delete-history-delivery-${delivery.id}`,
              onPress: onDelete,
              systemImage: 'trash',
              title: 'Excluir',
            },
          ]}
          preview={card(true)}
          style={[styles.contextMenu, { borderRadius: radius }]}
        >
          {card(false)}
        </NativeCardContextMenu>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clientDetails: { flex: 1, justifyContent: 'center', minWidth: 0 },
  clientName: { width: '100%' },
  card: {
    alignItems: 'center',
    flexDirection: 'row',
    flexGrow: 0,
    flexShrink: 1,
    width: '100%',
  },
  container: { flexGrow: 0, flexShrink: 1, overflow: 'hidden', width: '100%' },
  contextMenu: { flexGrow: 0, flexShrink: 1, height: '100%', width: '100%' },
  shadow: { flexGrow: 0, flexShrink: 1, width: '100%' },
  statusDot: { borderRadius: 4, height: 7, width: 7 },
});
