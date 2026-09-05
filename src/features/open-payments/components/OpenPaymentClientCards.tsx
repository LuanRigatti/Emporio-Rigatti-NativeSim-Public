import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/feedback';
import { NativeCardContextMenu } from '@/components/native';
import { GlassCard } from '@/components/premium';
import { getCardSurfaceColor, lightTheme, useAppTheme } from '@/theme';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import { formatDateAsDayMonthYear } from '@/utils/groupItemsByDate';

import type { OpenPaymentClientCard } from '../hooks/useOpenPaymentClients';

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
  const cardMinHeight =
    theme.spacing.md * 2 +
    theme.typography.callout.lineHeight +
    theme.spacing.xxs / 2 +
    theme.typography.footnote.lineHeight;

  const renderRow = (client: OpenPaymentClientCard, preview = false) => (
    <View
      style={[
        styles.card,
        {
          backgroundColor: preview ? openPaymentCardSurface : 'transparent',
          borderRadius: theme.radius.xl + theme.spacing.sm,
          overflow: preview ? 'hidden' : undefined,
          padding: theme.spacing.md,
          minHeight: cardMinHeight,
          width: '100%',
        },
      ]}
    >
      <Text
        style={[
          theme.typography.callout,
          {
            color: theme.colors.textPrimary,
            fontSize: theme.typography.callout.fontSize + 1,
            fontWeight: theme.typography.headline.fontWeight,
            marginLeft: theme.spacing.xxs,
          },
        ]}
      >
        {client.nome}
      </Text>
      <Badge
        label={maskCurrency(client.valor)}
        labelStyle={[
          theme.typography.footnote,
          {
            color: resolvedMode === 'dark' ? theme.colors.danger : lightTheme.colors.danger,
            fontWeight: theme.typography.headline.fontWeight,
          },
        ]}
        style={{
          backgroundColor:
            resolvedMode === 'dark' ? theme.colors.dangerSurface : lightTheme.colors.dangerSurface,
          transform: [{ translateY: 10 }],
        }}
        tone="danger"
      />
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
    justifyContent: 'space-between',
    width: '100%',
  },
});
