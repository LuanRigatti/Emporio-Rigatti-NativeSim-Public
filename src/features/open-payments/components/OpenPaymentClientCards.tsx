import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import {
  MeasuredContextMenuGeometry,
  type ContextMenuCardGeometryStyle,
} from '@/components/layout/MeasuredContextMenuGeometry';
import type { NativeCardContextMenuAction } from '@/components/native';
import { GlassCard } from '@/components/premium';
import { useAppSafeAreaInsets } from '@/providers';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import { formatDateAsDayMonthYear } from '@/utils/groupItemsByDate';

import type { OpenPaymentClientCard } from '../hooks/useOpenPaymentClients';
import {
  buildOpenPaymentNativePreview,
  getOpenPaymentClientPreviewIdentifier,
} from '../data/openPaymentNativePreview';
import OpenPaymentClientIcon from './OpenPaymentClientIcon';
import { OpenPaymentClientContextMenu } from './OpenPaymentClientContextMenu';

export type OpenPaymentClientCardsProps = {
  clients: readonly OpenPaymentClientCard[];
  paymentHistoryError?: string;
  paymentHistoryLoading: boolean;
  onMarkAsPaid: (deliveryId: string) => void;
  testModeEnabled: boolean;
  nativePeekPopEnabled?: boolean;
};

export function OpenPaymentClientCards({
  clients,
  paymentHistoryError,
  paymentHistoryLoading,
  onMarkAsPaid,
  nativePeekPopEnabled = false,
  testModeEnabled,
}: OpenPaymentClientCardsProps) {
  const { resolvedMode, theme } = useAppTheme();
  const insets = useAppSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const openPaymentCardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const { currency: maskCurrency } = useTestModePresentation();
  const cardMinHeight = 54 + theme.spacing.sm * 2;
  const previewWidth = Math.max(0, windowWidth - insets.left - insets.right - theme.spacing.md * 2);

  const renderRow = (
    client: OpenPaymentClientCard,
    geometryStyle?: ContextMenuCardGeometryStyle,
  ) => (
    <View
      style={[
        styles.card,
        {
          borderRadius: theme.radius.xl + theme.spacing.sm,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          minHeight: cardMinHeight,
          width: '100%',
        },
        geometryStyle,
      ]}
      testID="open-payment-client-trigger"
    >
      <OpenPaymentClientIcon backgroundColor={theme.colors.background} iconName="person" />
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
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          Cliente
        </Text>
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

  const renderPreview = (client: OpenPaymentClientCard) => (
    <View
      style={[
        styles.previewCard,
        {
          backgroundColor: openPaymentCardSurface,
          borderRadius: theme.radius.xl + theme.spacing.sm,
          gap: theme.spacing.md,
          overflow: 'hidden',
          padding: theme.spacing.md,
          width: previewWidth,
        },
      ]}
      testID="open-payment-rich-preview"
    >
      <View style={[styles.previewHeader, { gap: theme.spacing.sm }]}>
        <OpenPaymentClientIcon backgroundColor={theme.colors.background} iconName="person" />
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
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Cliente
          </Text>
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
      <View style={{ gap: theme.spacing.xs }}>
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
          Últimos pagamentos
        </Text>
        {paymentHistoryLoading ? (
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Carregando pagamentos…
          </Text>
        ) : paymentHistoryError ? (
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Não foi possível carregar os pagamentos.
          </Text>
        ) : client.recentPayments.length > 0 ? (
          client.recentPayments.map((payment) => (
            <View key={payment.id} style={styles.paymentRow}>
              <View style={[styles.paymentDescription, { gap: theme.spacing.xxs }]}>
                <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                  {formatDateAsDayMonthYear(payment.data)}
                </Text>
                {payment.metodoPagamento ? (
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    {payment.metodoPagamento}
                  </Text>
                ) : null}
              </View>
              <Text style={[theme.typography.footnote, { color: theme.colors.textPrimary }]}>
                {maskCurrency(payment.valor)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Sem pagamentos anteriores
          </Text>
        )}
      </View>
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
          <MeasuredContextMenuGeometry key={client.nome}>
            {({ onLayout, triggerWidthStyle }) => (
              <View onLayout={onLayout} style={{ height: cardMinHeight, width: '100%' }}>
                <OpenPaymentClientContextMenu
                  actions={client.deliveries.map<NativeCardContextMenuAction>((delivery) => ({
                    id: `complete-payment-${delivery.id}`,
                    disabled: testModeEnabled,
                    onPress: () => onMarkAsPaid(delivery.id),
                    systemImage: 'checkmark.circle.fill' as const,
                    title:
                      client.deliveries.length === 1
                        ? 'Pago'
                        : `Pago · ${formatDateAsDayMonthYear(delivery.data)} · ${maskCurrency(delivery.valor)}`,
                  }))}
                  identifier={getOpenPaymentClientPreviewIdentifier(client)}
                  nativePeekPopEnabled={nativePeekPopEnabled}
                  nativePreview={buildOpenPaymentNativePreview(client, {
                    cardSurfaceColor: openPaymentCardSurface,
                    formatCurrency: maskCurrency,
                    paymentHistoryError,
                    paymentHistoryLoading,
                    pageBackgroundColor: theme.colors.background,
                  })}
                  preview={renderPreview(client)}
                  style={[
                    styles.contextMenu,
                    {
                      borderRadius: theme.radius.xl + theme.spacing.sm,
                      height: '100%',
                    },
                  ]}
                >
                  {renderRow(client, triggerWidthStyle)}
                </OpenPaymentClientContextMenu>
              </View>
            )}
          </MeasuredContextMenuGeometry>
        ))}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  cards: { width: '100%' },
  clientListCard: { width: '100%' },
  contextMenu: { width: '100%' },
  previewCard: { alignSelf: 'center' },
  previewHeader: { alignItems: 'center', flexDirection: 'row' },
  paymentDescription: { flex: 1 },
  paymentRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  card: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  clientInfo: { flex: 1, gap: 2 },
});
