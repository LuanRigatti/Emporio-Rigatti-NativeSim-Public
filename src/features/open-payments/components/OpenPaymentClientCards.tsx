import { StyleSheet, Text, View } from 'react-native';

import { NativeCardContextMenu } from '@/components/native';
import { GlassCard } from '@/components/premium';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import { formatDateAsDayMonthYear } from '@/utils/groupItemsByDate';

import type { OpenPaymentClientCard } from '../hooks/useOpenPaymentClients';
import OpenPaymentClientIcon from './OpenPaymentClientIcon';

export type OpenPaymentClientCardsProps = {
  clients: readonly OpenPaymentClientCard[];
  onMarkAsPaid: (deliveryId: string) => void;
  testModeEnabled: boolean;
};

export function OpenPaymentClientCards({
  clients,
  onMarkAsPaid,
  testModeEnabled,
}: OpenPaymentClientCardsProps) {
  const { resolvedMode, theme } = useAppTheme();
  const openPaymentCardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const { currency: maskCurrency } = useTestModePresentation();
  const cardMinHeight = 54 + theme.spacing.sm * 2;

  const renderRow = (client: OpenPaymentClientCard, preview = false) => (
    <View
      style={[
        styles.card,
        {
          backgroundColor: preview ? openPaymentCardSurface : 'transparent',
          borderRadius: theme.radius.xl + theme.spacing.sm,
          overflow: preview ? 'hidden' : undefined,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          minHeight: cardMinHeight,
          width: '100%',
        },
      ]}
    >
      <OpenPaymentClientIcon />
      <View style={styles.clientInfo}>
        <Text
          style={[
            theme.typography.body,
            {
              color: theme.colors.textPrimary,
              fontWeight: theme.typography.headline.fontWeight,
            },
          ]}
        >
          {client.nome}
        </Text>
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>Cliente</Text>
      </View>
      <Text
        style={[
          theme.typography.body,
          {
            color: theme.colors.textPrimary,
            fontWeight: theme.typography.headline.fontWeight,
          },
        ]}
      >
        {maskCurrency(client.valor)}
      </Text>
    </View>
  );

  if (clients.length === 0) return null;

  return (
    <GlassCard
      style={[
        styles.clientListCard,
        {
          backgroundColor: openPaymentCardSurface,
          borderRadius: theme.radius.xl + theme.spacing.sm,
          paddingHorizontal: theme.spacing.xs,
          paddingVertical: theme.spacing.xs,
        },
      ]}
    >
      <View style={[styles.cards, { gap: theme.spacing.xs }]}>
        {clients.map((client) => (
          <View key={client.nome} style={{ height: cardMinHeight, width: '100%' }}>
            <NativeCardContextMenu
              actions={client.deliveries.map((delivery) => ({
                id: `complete-payment-${delivery.id}`,
                disabled: testModeEnabled,
                onPress: () => onMarkAsPaid(delivery.id),
                systemImage: 'checkmark.circle.fill' as const,
                title:
                  client.deliveries.length === 1
                    ? 'Pago'
                    : `Pago · ${formatDateAsDayMonthYear(delivery.data)} · ${maskCurrency(delivery.valor)}`,
              }))}
              preview={renderRow(client, true)}
              style={[
                styles.contextMenu,
                {
                  borderRadius: theme.radius.xl + theme.spacing.sm,
                  height: '100%',
                },
              ]}
            >
              {renderRow(client)}
            </NativeCardContextMenu>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  cards: { width: '100%' },
  clientListCard: { width: '100%' },
  contextMenu: { width: '100%' },
  card: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  clientInfo: { flex: 1, gap: 2 },
});
