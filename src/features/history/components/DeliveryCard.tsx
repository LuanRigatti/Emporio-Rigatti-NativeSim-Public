import { useCallback, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';

import { NativeCardContextMenu } from '@/components/native';
import { GlassCard } from '@/components/premium';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type { HistoryDelivery } from '../data/historyMocks';
import { DeliveryStatusBadge } from './DeliveryStatusBadge';
import OpenPaymentClientIcon from '@/features/open-payments/components/OpenPaymentClientIcon';

const HISTORY_DELIVERY_CARD_HEIGHT = 86;

export type DeliveryCardProps = {
  delivery: HistoryDelivery;
  onOpenStatusSheet: () => void;
  onMarkDelivered?: () => void;
  onDelete?: () => void;
  contained?: boolean;
};

function statusLabel(status: HistoryDelivery['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function DeliveryCard({
  contained = false,
  delivery,
  onDelete,
  onMarkDelivered,
  onOpenStatusSheet,
}: DeliveryCardProps) {
  const [previewSize, setPreviewSize] = useState<{ height: number; width: number } | null>(null);
  const { resolvedMode, theme } = useAppTheme();
  const cardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const {
    enabled: testModeEnabled,
    quantity: maskQuantity,
    text: maskText,
  } = useTestModePresentation();
  const cardRadius = theme.radius.xl + theme.spacing.sm;
  const handleCardLayout = useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;

    setPreviewSize((current) =>
      current?.width === width && current.height === height ? current : { height, width },
    );
  }, []);
  const measuredPreviewSize: ViewStyle | undefined = previewSize
    ? { height: previewSize.height, width: previewSize.width }
    : undefined;
  const cardLayoutStyle: ViewStyle = {
    minHeight: HISTORY_DELIVERY_CARD_HEIGHT,
    paddingVertical: theme.spacing.xs,
  };
  const content = (
    <View style={styles.cardRow}>
      <OpenPaymentClientIcon backgroundColor={theme.colors.background} iconName="person" />
      <View style={styles.cardContent}>
        <View style={styles.clientDetails}>
          <Text
            accessibilityLabel={delivery.cliente}
            ellipsizeMode="tail"
            numberOfLines={1}
            style={[theme.typography.headline, { color: theme.colors.textPrimary }]}
          >
            {delivery.cliente}
          </Text>
          <Text style={[theme.typography.callout, { color: theme.colors.textPrimary }]}>
            {maskQuantity(delivery.quantidadeBaldes)}
          </Text>
        </View>
        <View style={styles.financialColumn}>
          <View style={styles.statusRow}>
            <View style={styles.deliveryBadgeTarget}>
              <DeliveryStatusBadge
                disabled={testModeEnabled}
                onPress={onOpenStatusSheet}
                status={delivery.status}
              />
            </View>
          </View>
          <Text
            numberOfLines={1}
            style={[
              theme.typography.callout,
              { color: theme.colors.textPrimary, textAlign: 'right' },
            ]}
          >
            {maskText(delivery.valor)}
          </Text>
        </View>
      </View>
    </View>
  );

  const card = contained ? (
    <View
      style={[
        styles.card,
        cardLayoutStyle,
        {
          backgroundColor: cardSurface,
          borderRadius: theme.radius.xl + theme.spacing.sm,
          width: '100%',
        },
      ]}
    >
      {content}
    </View>
  ) : (
    <GlassCard
      accessibilityLabel={`Entrega para ${delivery.cliente}, ${statusLabel(delivery.status)}`}
      style={[
        styles.card,
        cardLayoutStyle,
        {
          backgroundColor: cardSurface,
          borderWidth: 0,
          borderRadius: theme.radius.xl + theme.spacing.sm,
          marginHorizontal: 0,
        },
      ]}
    >
      {content}
    </GlassCard>
  );
  const contextCardStyle: ViewStyle = {
    backgroundColor: cardSurface,
    borderRadius: cardRadius,
    minHeight: HISTORY_DELIVERY_CARD_HEIGHT,
    width: '100%',
  };

  return onDelete ? (
    <View onLayout={handleCardLayout} style={[styles.contextContainer, contextCardStyle]}>
      <NativeCardContextMenu
        actions={[
          ...(delivery.status === 'pendente' && onMarkDelivered
            ? [
                {
                  disabled: testModeEnabled,
                  id: `complete-delivery-${delivery.id}`,
                  onPress: onMarkDelivered,
                  systemImage: 'checkmark.circle.fill' as const,
                  title: 'Concluída',
                },
              ]
            : []),
          {
            destructive: true,
            disabled: testModeEnabled,
            id: 'delete-delivery',
            onPress: onDelete,
            systemImage: 'trash',
            title: 'Excluir',
          },
        ]}
        matchContents={{ vertical: true }}
        style={[styles.contextMenu, { borderRadius: cardRadius }]}
        triggerMatchContents={{ vertical: true }}
        preview={
          <View
            style={[
              styles.card,
              cardLayoutStyle,
              contextCardStyle,
              { overflow: 'hidden' },
              measuredPreviewSize,
            ]}
          >
            {content}
          </View>
        }
      >
        <View style={[styles.card, cardLayoutStyle, { backgroundColor: 'transparent' }]}>
          {content}
        </View>
      </NativeCardContextMenu>
    </View>
  ) : (
    card
  );
}

const styles = StyleSheet.create({
  card: { paddingLeft: 20, paddingRight: 14, width: '100%' },
  cardRow: { alignItems: 'center', flexDirection: 'row', gap: 12, width: '100%' },
  cardContent: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, minWidth: 0 },
  clientDetails: { flex: 1, gap: 4, minWidth: 0 },
  contextContainer: { overflow: 'hidden' },
  contextMenu: { width: '100%' },
  deliveryBadgeTarget: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  financialColumn: { alignItems: 'flex-end', flexShrink: 0, gap: 4 },
  statusRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'flex-end' },
});
