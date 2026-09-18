import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, EmptyState, ErrorState, InlineError, Loading } from '@/components/feedback';
import { NativeGlassHeader } from '@/components/layout';
import { NativeButton, NativeDialog } from '@/components/native';
import { PremiumCard, PremiumScreen, PremiumSection } from '@/components/premium';
import { useRetailOrderDetail } from '@/hooks/useRetailOrderDetail';
import { useRetailOrderPayments } from '@/hooks/useRetailOrderPayments';
import { useRetailOrderStatus } from '@/hooks/useRetailOrderStatus';
import { useAuth } from '@/providers';
import {
  calculateRetailOrderFinancials,
  retailOrderHistoryFinancialSummaryService,
} from '@/services/retail-orders';
import type { RetailOrder, RetailOrderFinancialSummary, RetailPayment } from '@/types/data';
import { useAppTheme } from '@/theme';
import { formatCurrency, formatPtBrDate } from '@/utils/data';

import { RetailOrderPaymentSheet } from './RetailOrderPaymentSheet';

type RetailOrderDetailScreenProps = {
  orderId?: string;
};

export function RetailOrderDetailScreen({ orderId }: RetailOrderDetailScreenProps) {
  const { theme } = useAppTheme();
  const detail = useRetailOrderDetail(orderId);
  const { sessionVersion, user } = useAuth();
  const userId = user?.id;
  const {
    cancel: cancelOrder,
    complete: completeOrder,
    error: statusMutationError,
    pending: statusMutationPending,
  } = useRetailOrderStatus(orderId);
  const [cancelDialogVisible, setCancelDialogVisible] = useState(false);
  const handleComplete = useCallback(() => {
    void completeOrder();
  }, [completeOrder]);
  const handleCancelRequest = useCallback(() => {
    setCancelDialogVisible(true);
  }, []);
  const handleCancelConfirmed = useCallback(() => {
    setCancelDialogVisible(false);
    void cancelOrder();
  }, [cancelOrder]);
  const handlePaymentRegistered = useCallback(
    (registeredOrderId: string, payments: readonly RetailPayment[]) => {
      if (!detail.order || registeredOrderId !== detail.order.orderId || !userId) return;
      retailOrderHistoryFinancialSummaryService.updateForOrder(
        detail.order,
        payments,
        userId,
        sessionVersion,
      );
    },
    [detail.order, sessionVersion, userId],
  );
  const paymentState = useRetailOrderPayments(orderId, {
    onRegisterSuccess: handlePaymentRegistered,
  });
  const [paymentSheetVisible, setPaymentSheetVisible] = useState(false);
  const financialState = useMemo(() => {
    if (!detail.order || paymentState.snapshot === null || paymentState.error) return undefined;
    try {
      return {
        summary: calculateRetailOrderFinancials({
          order: detail.order,
          payments: paymentState.payments,
        }),
      };
    } catch (calculationError) {
      return {
        error:
          calculationError instanceof Error
            ? calculationError.message
            : 'Não foi possível calcular o resumo financeiro.',
      };
    }
  }, [detail.order, paymentState.error, paymentState.payments, paymentState.snapshot]);

  const header = <NativeGlassHeader mode="transparent" title="Pedido Varejo" />;
  const body = !detail.order ? (
    detail.loading ? (
      <Loading label="Carregando pedido Varejo…" />
    ) : detail.notFound ? (
      <EmptyState title="Pedido não encontrado" />
    ) : (
      <ErrorState
        description={detail.error ?? 'Não foi possível carregar este pedido.'}
        onRetry={() => void detail.refresh()}
        title="Não foi possível carregar o pedido"
      />
    )
  ) : (
    <OrderDetailsContent
      financialState={financialState}
      onCancel={handleCancelRequest}
      onComplete={handleComplete}
      onAddPayment={() => setPaymentSheetVisible(true)}
      order={detail.order}
      paymentState={paymentState}
      statusMutationError={statusMutationError}
      statusMutationPending={statusMutationPending}
      theme={theme}
    />
  );

  return (
    <>
      <PremiumScreen
        contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xxl }}
        overlayHeader={header}
        overlayHeaderSpacing={theme.spacing.sm}
        progressiveBlur
      >
        {detail.revalidating ? <Loading label="Atualizando pedido…" /> : null}
        {detail.error && detail.order ? (
          <InlineError message={`Atualização indisponível: ${detail.error}`} />
        ) : null}
        {body}
      </PremiumScreen>
      <RetailOrderPaymentSheet
        onRegister={paymentState.register}
        onVisibleChange={setPaymentSheetVisible}
        outstandingAmount={financialState?.summary?.outstandingAmount ?? 0}
        visible={paymentSheetVisible}
      />
      <NativeDialog
        actions={[
          {
            destructive: true,
            id: 'cancel-order',
            onPress: handleCancelConfirmed,
            title: 'Cancelar pedido',
          },
        ]}
        message="O pedido será cancelado, mas os pagamentos existentes serão preservados para auditoria."
        onDismiss={() => setCancelDialogVisible(false)}
        title="Cancelar pedido?"
        visible={cancelDialogVisible}
      />
    </>
  );
}

function OrderDetailsContent({
  financialState,
  onCancel,
  onComplete,
  onAddPayment,
  order,
  paymentState,
  statusMutationError,
  statusMutationPending,
  theme,
}: {
  financialState?: { summary: RetailOrderFinancialSummary } | { error: string };
  onCancel: () => void;
  onComplete: () => void;
  onAddPayment: () => void;
  order: RetailOrder;
  paymentState: ReturnType<typeof useRetailOrderPayments>;
  statusMutationError?: string;
  statusMutationPending: boolean;
  theme: ReturnType<typeof useAppTheme>['theme'];
}) {
  return (
    <View style={[styles.sections, { gap: theme.spacing.xl }]}>
      <PremiumSection title="Pedido">
        <PremiumCard style={[styles.card, { gap: theme.spacing.sm }]}>
          <View style={styles.statusRow}>
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              Status
            </Text>
            <Badge
              label={operationalStatusLabel(order.status)}
              tone={operationalStatusTone(order.status)}
            />
          </View>
          <DetailRow label="Data do pedido" value={formatPtBrDate(order.orderDate)} />
          <DetailRow label="Data de entrega" value={formatPtBrDate(order.deliveryDate)} />
        </PremiumCard>
      </PremiumSection>

      {order.status === 'created' ? (
        <PremiumSection title="Ações do pedido">
          <PremiumCard style={[styles.card, { gap: theme.spacing.sm }]}>
            <NativeButton
              accessibilityLabel="Concluir pedido"
              disabled={statusMutationPending}
              haptic="light"
              label="Concluir pedido"
              onPress={onComplete}
              variant="primary"
            />
            <NativeButton
              accessibilityLabel="Cancelar pedido"
              destructive
              disabled={statusMutationPending}
              haptic="light"
              label="Cancelar pedido"
              onPress={onCancel}
              variant="primary"
            />
            {statusMutationError ? <InlineError message={statusMutationError} /> : null}
            {statusMutationPending ? <Loading label="Atualizando pedido…" /> : null}
          </PremiumCard>
        </PremiumSection>
      ) : null}

      <PremiumSection title="Cliente">
        <PremiumCard style={[styles.card, { gap: theme.spacing.sm }]}>
          <DetailRow label="Nome" value={order.clientNameSnapshot} />
          <DetailRow label="Telefone" value={order.clientPhoneSnapshot ?? 'Não informado'} />
          <DetailRow
            label="Endereço cadastrado"
            value={order.clientAddressSnapshot ?? 'Não informado'}
          />
          <DetailRow label="Endereço de entrega" value={order.deliveryAddressSnapshot} />
        </PremiumCard>
      </PremiumSection>

      <PremiumSection title="Produtos">
        <View style={[styles.products, { gap: theme.spacing.sm }]}>
          {order.lineItems.map((lineItem) => (
            <PremiumCard
              key={`${lineItem.productId}-${lineItem.productNameSnapshot}`}
              style={[styles.card, { gap: theme.spacing.sm }]}
            >
              <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                {lineItem.productNameSnapshot}
              </Text>
              <DetailRow label="Categoria" value={lineItem.categorySnapshot} />
              {lineItem.variantSnapshot ? (
                <DetailRow label="Variante" value={lineItem.variantSnapshot} />
              ) : null}
              {lineItem.flavorSnapshot ? (
                <DetailRow label="Sabor" value={lineItem.flavorSnapshot} />
              ) : null}
              {lineItem.packageSizeSnapshot ? (
                <DetailRow label="Embalagem" value={lineItem.packageSizeSnapshot} />
              ) : null}
              <DetailRow label="Quantidade" value={String(lineItem.quantity)} />
              <DetailRow
                label="Preço unitário"
                value={formatCurrency(lineItem.unitSalePriceSnapshot)}
              />
              <DetailRow label="Subtotal" value={formatCurrency(lineItem.lineSubtotal)} />
            </PremiumCard>
          ))}
        </View>
      </PremiumSection>

      <PremiumSection title="Valores">
        <PremiumCard style={[styles.card, { gap: theme.spacing.sm }]}>
          <DetailRow label="Subtotal dos produtos" value={formatCurrency(order.subtotalProducts)} />
          <DetailRow label="Desconto" value={formatCurrency(order.discount)} />
          <DetailRow label="Taxa de entrega" value={formatCurrency(order.deliveryFee)} />
          <DetailRow label="Total cobrado" value={formatCurrency(order.totalCharged)} strong />
        </PremiumCard>
      </PremiumSection>

      <PremiumSection title="Pagamentos">
        <PaymentsContent paymentState={paymentState} theme={theme} />
      </PremiumSection>

      <PremiumSection title="Resumo financeiro">
        <FinancialSummaryContent
          financialState={financialState}
          onAddPayment={onAddPayment}
          order={order}
          paymentState={paymentState}
          theme={theme}
        />
      </PremiumSection>

      {order.occasion || order.recipient || order.notes ? (
        <PremiumSection title="Informações">
          <PremiumCard style={[styles.card, { gap: theme.spacing.sm }]}>
            {order.occasion ? <DetailRow label="Ocasião" value={order.occasion} /> : null}
            {order.recipient ? <DetailRow label="Presenteado" value={order.recipient} /> : null}
            {order.notes ? <DetailRow label="Observações" value={order.notes} /> : null}
          </PremiumCard>
        </PremiumSection>
      ) : null}
    </View>
  );
}

function PaymentsContent({
  paymentState,
  theme,
}: {
  paymentState: ReturnType<typeof useRetailOrderPayments>;
  theme: ReturnType<typeof useAppTheme>['theme'];
}) {
  if (paymentState.loading && paymentState.snapshot === null) {
    return <Loading label="Carregando pagamentos…" />;
  }
  if (paymentState.error && paymentState.snapshot === null) {
    return (
      <ErrorState
        description={paymentState.error}
        onRetry={() => void paymentState.reload()}
        title="Não foi possível carregar pagamentos"
      />
    );
  }
  return (
    <PremiumCard style={[styles.card, { gap: theme.spacing.sm }]}>
      {paymentState.payments.length ? (
        paymentState.payments.map((payment) => (
          <PaymentRow key={payment.paymentId} payment={payment} theme={theme} />
        ))
      ) : (
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          Nenhum pagamento registrado.
        </Text>
      )}
      {paymentState.error ? (
        <InlineError message={`Atualização dos pagamentos indisponível: ${paymentState.error}`} />
      ) : null}
      {paymentState.refreshing ? <Loading label="Atualizando pagamentos…" /> : null}
    </PremiumCard>
  );
}

function FinancialSummaryContent({
  financialState,
  onAddPayment,
  order,
  paymentState,
  theme,
}: {
  financialState?: { summary: RetailOrderFinancialSummary } | { error: string };
  onAddPayment: () => void;
  order: RetailOrder;
  paymentState: ReturnType<typeof useRetailOrderPayments>;
  theme: ReturnType<typeof useAppTheme>['theme'];
}) {
  const summary =
    financialState && 'summary' in financialState ? financialState.summary : undefined;
  if (summary) {
    return (
      <PremiumCard style={[styles.card, { gap: theme.spacing.sm }]}>
        <DetailRow label="Total" value={formatCurrency(summary.totalCharged)} strong />
        <DetailRow label="Pago" value={formatCurrency(summary.paidAmount)} />
        <DetailRow label="A receber" value={formatCurrency(summary.outstandingAmount)} />
        <Badge label={financialStatusLabel(summary)} tone={financialStatusTone(summary)} />
        {order.status !== 'cancelled' && summary.outstandingAmount > 0 ? (
          <NativeButton
            accessibilityLabel="Adicionar pagamento"
            haptic="light"
            label="Adicionar pagamento"
            onPress={onAddPayment}
            variant="primary"
          />
        ) : null}
      </PremiumCard>
    );
  }

  if (paymentState.loading && paymentState.snapshot === null) {
    return <Loading label="Carregando resumo financeiro…" />;
  }

  const message =
    paymentState.error ??
    (financialState && 'error' in financialState ? financialState.error : undefined) ??
    'O resumo financeiro ficará disponível após carregar os pagamentos.';
  return (
    <ErrorState
      description={message}
      onRetry={() => void paymentState.reload()}
      style={styles.financeError}
      title="Resumo financeiro indisponível"
    />
  );
}

function PaymentRow({
  payment,
  theme,
}: {
  payment: RetailPayment;
  theme: ReturnType<typeof useAppTheme>['theme'];
}) {
  return (
    <View style={[styles.paymentRow, { gap: theme.spacing.md }]}>
      <View style={[styles.paymentCopy, { gap: theme.spacing.xs }]}>
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
          {payment.method} · {formatPtBrDate(payment.paidAt)}
        </Text>
        {payment.cardFee !== undefined ? (
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Taxa do cartão: {formatCurrency(payment.cardFee)}
          </Text>
        ) : null}
        {payment.notes ? (
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            {payment.notes}
          </Text>
        ) : null}
      </View>
      <View style={[styles.paymentValue, { gap: theme.spacing.xs }]}>
        <Text
          style={[theme.typography.body, { color: theme.colors.textPrimary, fontWeight: '600' }]}
        >
          {formatCurrency(payment.amount)}
        </Text>
        <Badge
          label={payment.status === 'posted' ? 'Registrado' : 'Anulado'}
          tone={payment.status === 'posted' ? 'success' : 'neutral'}
        />
      </View>
    </View>
  );
}

function DetailRow({
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
    <View style={[styles.detailRow, { gap: theme.spacing.xs }]}>
      <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
      <Text
        style={[
          theme.typography.body,
          { color: theme.colors.textPrimary, fontWeight: strong ? '700' : undefined },
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
  detailRow: {},
  financeError: { width: '100%' },
  paymentCopy: { flex: 1 },
  paymentRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentValue: { alignItems: 'flex-end' },
  products: { width: '100%' },
  sections: { width: '100%' },
  statusRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
