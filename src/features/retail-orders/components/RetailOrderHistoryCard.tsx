import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/feedback';
import { PremiumCard, type AnimatedPressableProps } from '@/components/premium';
import type { RetailOrder, RetailOrderFinancialSummary } from '@/types/data';
import { formatCurrency, formatPtBrDate } from '@/utils/data';
import { useAppTheme } from '@/theme';

import type { RetailOrderHistoryFinancialViewState } from '@/hooks/useRetailOrderHistory';

type RetailOrderHistoryCardProps = {
  order: RetailOrder;
  financialState?: RetailOrderHistoryFinancialViewState;
  onPress?: AnimatedPressableProps['onPress'];
};

export function RetailOrderHistoryCard({
  onPress,
  order,
  financialState,
}: RetailOrderHistoryCardProps) {
  const { theme } = useAppTheme();
  const summary = financialState?.status === 'ready' ? financialState.summary : undefined;
  const financialPlaceholder = financialState?.status === 'error' ? 'Indisponível' : 'Carregando…';
  const financialMessageColor =
    financialState?.status === 'error' ? theme.colors.danger : theme.colors.textSecondary;
  const revalidationError =
    financialState?.status === 'ready' ? financialState.revalidationError : undefined;
  const productSummary = order.lineItems
    .map((lineItem) => `${lineItem.quantity}× ${lineItem.productNameSnapshot}`)
    .join(' · ');

  return (
    <PremiumCard
      accessibilityLabel={`Abrir detalhes do pedido de ${order.clientNameSnapshot} em ${formatPtBrDate(order.orderDate)}`}
      onPress={onPress}
      style={[styles.card, { gap: theme.spacing.sm }]}
    >
      <View style={[styles.header, { gap: theme.spacing.xs }]}>
        <View style={styles.clientCopy}>
          <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
            {order.clientNameSnapshot}
          </Text>
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Pedido em {formatPtBrDate(order.orderDate)}
            {order.deliveryDate !== order.orderDate
              ? ` · Entrega em ${formatPtBrDate(order.deliveryDate)}`
              : ''}
          </Text>
        </View>
        <Badge
          label={operationalStatusLabel(order.status)}
          tone={operationalStatusTone(order.status)}
        />
      </View>

      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
        {productSummary}
      </Text>

      <View style={[styles.financials, { gap: theme.spacing.xs }]}>
        <FinancialRow label="Total" value={formatCurrency(order.totalCharged)} strong />
        {summary ? (
          <>
            <FinancialRow label="Pago" value={formatCurrency(summary.paidAmount)} />
            <FinancialRow label="A receber" value={formatCurrency(summary.outstandingAmount)} />
          </>
        ) : (
          <>
            <FinancialRow label="Pago" value={financialPlaceholder} />
            <FinancialRow label="A receber" value={financialPlaceholder} />
          </>
        )}
      </View>

      {summary ? (
        <>
          <Badge label={financialStatusLabel(summary)} tone={financialStatusTone(summary)} />
          {revalidationError ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.danger }]}>
              Atualização do pagamento indisponível: {revalidationError}
            </Text>
          ) : null}
        </>
      ) : null}
      {!summary ? (
        <Text style={[theme.typography.footnote, { color: financialMessageColor }]}>
          {financialState?.status === 'error'
            ? financialState.message
            : 'Status financeiro carregando…'}
        </Text>
      ) : null}
    </PremiumCard>
  );
}

function FinancialRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.row}>
      <Text
        style={[
          theme.typography.body,
          { color: theme.colors.textSecondary, fontWeight: strong ? '600' : undefined },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          theme.typography.body,
          { color: theme.colors.textPrimary, fontWeight: strong ? '700' : '600' },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function operationalStatusLabel(status: RetailOrder['status']): string {
  if (status === 'completed') return 'Concluído';
  if (status === 'cancelled') return 'Cancelado';
  return 'Em aberto';
}

function operationalStatusTone(status: RetailOrder['status']): 'success' | 'warning' | 'danger' {
  if (status === 'completed') return 'success';
  if (status === 'cancelled') return 'danger';
  return 'warning';
}

function financialStatusLabel(summary: RetailOrderFinancialSummary): string {
  if (summary.financialStatus === 'paid') return 'Pago';
  if (summary.financialStatus === 'partially_paid') return 'Parcialmente pago';
  return 'Não pago';
}

function financialStatusTone(summary: RetailOrderFinancialSummary): 'success' | 'warning' {
  return summary.financialStatus === 'paid' ? 'success' : 'warning';
}

const styles = StyleSheet.create({
  card: { width: '100%' },
  clientCopy: { flex: 1 },
  financials: { width: '100%' },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
