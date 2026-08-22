import { useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';

import { NativeCardContextMenu } from '@/components/native';
import { GlassCard } from '@/components/premium';
import { useAppTheme } from '@/theme';
import {
  logHistoryLayoutDiagnostics,
  logHistoryLayoutFrame,
} from '@/utils/historyLayoutDiagnostics';

import type { HistoryDelivery } from '../data/historyMocks';
import { DeliveryStatusBadge } from './DeliveryStatusBadge';

const HISTORY_DELIVERY_CARD_HEIGHT = 87;

export type DeliveryCardProps = {
  delivery: HistoryDelivery;
  onToggleStatus: () => void;
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
  onToggleStatus,
}: DeliveryCardProps) {
  const { resolvedMode, theme } = useAppTheme();
  const diagnosticsComponent = `History.DeliveryCard.${delivery.id}`;

  useEffect(() => {
    logHistoryLayoutDiagnostics(delivery.id, diagnosticsComponent, 'mount');
  }, [delivery.id, diagnosticsComponent]);

  const handleHistoryLayout = (event: LayoutChangeEvent) => {
    logHistoryLayoutFrame(delivery.id, diagnosticsComponent, event.nativeEvent.layout);
  };

  const content = (
    <View style={styles.cardRow}>
      <View style={styles.cardContent}>
        <View style={styles.cardHeaderRow}>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            {delivery.cliente}
          </Text>
          <View style={styles.statusInset}>
            <DeliveryStatusBadge onPress={onToggleStatus} status={delivery.status} />
          </View>
        </View>

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
  );

  const card = contained ? (
    <View
      style={[
        styles.card,
        {
          backgroundColor: resolvedMode === 'dark' ? theme.colors.surfaceElevated : theme.colors.surface,
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
        {
          backgroundColor: resolvedMode === 'dark' ? theme.colors.surfaceElevated : theme.colors.surface,
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
    backgroundColor: resolvedMode === 'dark' ? theme.colors.surfaceElevated : theme.colors.surface,
    borderRadius: theme.radius.xl + theme.spacing.sm,
    height: HISTORY_DELIVERY_CARD_HEIGHT,
    width: '100%',
  };

  return onDelete ? (
    <View
      onLayout={(event) => {
        handleHistoryLayout(event);
      }}
      style={[styles.contextContainer, contextCardStyle]}
    >
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
        diagnosticsDeliveryId={delivery.id}
        diagnosticsLabel={diagnosticsComponent}
        style={[styles.contextMenu, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
        preview={
          <View style={[styles.card, contextCardStyle, { overflow: 'hidden' }]}>{content}</View>
        }
      >
        <View style={[styles.card, { backgroundColor: 'transparent' }]}>{content}</View>
      </NativeCardContextMenu>
    </View>
  ) : (
    card
  );
}

const styles = StyleSheet.create({
  card: { paddingLeft: 20, paddingRight: 14, paddingVertical: 18, width: '100%' },
  cardRow: { alignItems: 'stretch', flexDirection: 'row', gap: 10, width: '100%' },
  cardContent: { flex: 1, gap: 8 },
  cardHeaderRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  contextContainer: { overflow: 'hidden' },
  contextMenu: { height: '100%', width: '100%' },
  primaryInfo: { flexDirection: 'row', justifyContent: 'space-between', paddingRight: 8 },
  statusInset: { marginRight: 8 },
});
