import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState, ErrorState, InlineError, Loading } from '@/components/feedback';
import { NativeGlassHeader } from '@/components/layout';
import { NativeButton, NativeDatePicker, NativeTextField } from '@/components/native';
import { PremiumCard, PremiumScreen, PremiumSection } from '@/components/premium';
import { useRetailOrderDetail } from '@/hooks/useRetailOrderDetail';
import { useRetailOrderEdit } from '@/hooks/useRetailOrderEdit';
import { useRetailOrderPayments } from '@/hooks/useRetailOrderPayments';
import { useAuth } from '@/providers';
import {
  retailOrderDataSource,
  retailOrderHistoryFinancialSummaryService,
} from '@/services/retail-orders';
import { normalizeRetailMoney } from '@/services/retail-costs';
import type { RetailOrder, RetailOrderPatch } from '@/types/data';
import { useAppTheme } from '@/theme';
import { parseIsoCalendarDate, todayIso } from '@/utils/data';

type RetailOrderEditScreenProps = {
  orderId?: string;
};

type RetailOrderEditDraft = {
  orderId: string;
  deliveryDate: string;
  deliveryAddressSnapshot: string;
  occasion: string;
  recipient: string;
  notes: string;
  discount: string;
  deliveryFee: string;
  deliveryCost: string;
};

function formatMoneyInput(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

function createDraft(order: RetailOrder): RetailOrderEditDraft {
  return {
    deliveryAddressSnapshot: order.deliveryAddressSnapshot,
    deliveryCost: formatMoneyInput(order.deliveryCost),
    deliveryDate: order.deliveryDate,
    deliveryFee: formatMoneyInput(order.deliveryFee),
    discount: formatMoneyInput(order.discount),
    notes: order.notes ?? '',
    occasion: order.occasion ?? '',
    orderId: order.orderId,
    recipient: order.recipient ?? '',
  };
}

function optionalText(value: string | undefined): string {
  return value?.trim() ?? '';
}

function buildPatch(
  order: RetailOrder,
  draft: RetailOrderEditDraft,
): { financialChanged: boolean; patch: RetailOrderPatch } {
  const patch: RetailOrderPatch = {};
  if (draft.deliveryDate !== order.deliveryDate) patch.deliveryDate = draft.deliveryDate;
  if (draft.deliveryAddressSnapshot.trim() !== order.deliveryAddressSnapshot) {
    patch.deliveryAddressSnapshot = draft.deliveryAddressSnapshot;
  }
  if (optionalText(draft.occasion) !== optionalText(order.occasion)) {
    patch.occasion = draft.occasion;
  }
  if (optionalText(draft.recipient) !== optionalText(order.recipient)) {
    patch.recipient = draft.recipient;
  }
  if (optionalText(draft.notes) !== optionalText(order.notes)) patch.notes = draft.notes;

  const nextDiscount = normalizeRetailMoney(draft.discount, 'O desconto');
  const nextDeliveryFee = normalizeRetailMoney(draft.deliveryFee, 'A taxa de entrega');
  const nextDeliveryCost = normalizeRetailMoney(draft.deliveryCost, 'O custo da entrega');
  if (nextDiscount !== order.discount) patch.discount = nextDiscount;
  if (nextDeliveryFee !== order.deliveryFee) patch.deliveryFee = nextDeliveryFee;
  if (nextDeliveryCost !== order.deliveryCost) patch.deliveryCost = nextDeliveryCost;

  return {
    financialChanged:
      patch.discount !== undefined ||
      patch.deliveryFee !== undefined ||
      patch.deliveryCost !== undefined,
    patch,
  };
}

export function RetailOrderEditScreen({ orderId }: RetailOrderEditScreenProps) {
  const { theme } = useAppTheme();
  const router = useRouter();
  const { sessionVersion, user } = useAuth();
  const detail = useRetailOrderDetail(orderId);
  const paymentState = useRetailOrderPayments(orderId);
  const edit = useRetailOrderEdit(orderId);
  const [draft, setDraft] = useState<RetailOrderEditDraft>();
  const [validationError, setValidationError] = useState<string>();

  useEffect(() => {
    const nextOrder = detail.order;
    if (!nextOrder) return;
    // The draft is local form state initialized from the external order snapshot.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft((current) =>
      current?.orderId === nextOrder.orderId ? current : createDraft(nextOrder),
    );
  }, [detail.order]);

  const updateDraft = useCallback(
    <K extends keyof Omit<RetailOrderEditDraft, 'orderId'>>(
      key: K,
      value: RetailOrderEditDraft[K],
    ) => {
      setDraft((current) => (current ? { ...current, [key]: value } : current));
      setValidationError(undefined);
      edit.clearError();
    },
    [edit],
  );

  const handleSave = useCallback(async () => {
    if (!detail.order || !draft || detail.order.status !== 'created') return;
    setValidationError(undefined);
    let prepared: ReturnType<typeof buildPatch>;
    try {
      prepared = buildPatch(detail.order, draft);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Informe valores válidos.');
      return;
    }

    if (!Object.keys(prepared.patch).length) {
      router.back();
      return;
    }

    const saved = await edit.save(prepared.patch);
    if (!saved) return;

    if (prepared.financialChanged && user?.id && paymentState.snapshot !== null) {
      const updatedOrder = retailOrderDataSource.getById(
        detail.order.orderId,
        user.id,
        sessionVersion,
      );
      if (updatedOrder) {
        try {
          retailOrderHistoryFinancialSummaryService.updateForOrder(
            updatedOrder,
            paymentState.payments,
            user.id,
            sessionVersion,
          );
        } catch {
          // A local summary failure must not turn a persisted order update into a save error.
        }
      }
    }

    router.back();
  }, [detail.order, draft, edit, paymentState, router, sessionVersion, user]);

  const header = <NativeGlassHeader mode="transparent" title="Editar pedido" />;
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
  ) : detail.order.status !== 'created' ? (
    <EmptyState
      description="Somente pedidos criados podem ser editados nesta fase."
      title="Pedido somente para consulta"
    />
  ) : !draft ? (
    <Loading label="Preparando edição…" />
  ) : paymentState.snapshot === null ? (
    paymentState.error ? (
      <ErrorState
        description={paymentState.error}
        onRetry={() => void paymentState.reload()}
        title="Não foi possível carregar os pagamentos"
      />
    ) : (
      <Loading label="Carregando pagamentos para configurar a edição…" />
    )
  ) : (
    <EditForm
      draft={draft}
      error={validationError ?? edit.error}
      hasPostedPayments={paymentState.payments.some((payment) => payment.status === 'posted')}
      onChange={updateDraft}
      onSave={() => void handleSave()}
      pending={edit.pending}
      paymentError={paymentState.error}
      theme={theme}
    />
  );

  return (
    <PremiumScreen
      contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xxl }}
      overlayHeader={header}
      overlayHeaderSpacing={theme.spacing.sm}
      progressiveBlur
      scrollViewProps={{
        automaticallyAdjustKeyboardInsets: true,
        keyboardDismissMode: 'interactive',
      }}
    >
      {detail.revalidating ? <Loading label="Atualizando pedido…" /> : null}
      {detail.error && detail.order ? (
        <InlineError message={`Atualização indisponível: ${detail.error}`} />
      ) : null}
      {body}
    </PremiumScreen>
  );
}

function EditForm({
  draft,
  error,
  hasPostedPayments,
  onChange,
  onSave,
  pending,
  paymentError,
  theme,
}: {
  draft: RetailOrderEditDraft;
  error?: string;
  hasPostedPayments: boolean;
  onChange: <K extends keyof Omit<RetailOrderEditDraft, 'orderId'>>(
    key: K,
    value: RetailOrderEditDraft[K],
  ) => void;
  onSave: () => void;
  pending: boolean;
  paymentError?: string;
  theme: ReturnType<typeof useAppTheme>['theme'];
}) {
  const financialDisabled = pending || hasPostedPayments;
  return (
    <View style={[styles.sections, { gap: theme.spacing.xl }]}>
      <PremiumSection title="Entrega">
        <PremiumCard style={[styles.card, { gap: theme.spacing.md }]}>
          <View style={styles.dateRow}>
            <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
              Data de entrega
            </Text>
            <NativeDatePicker
              accessibilityLabel="Data de entrega"
              mode="date"
              onChange={(date) => onChange('deliveryDate', todayIso(date))}
              style="compact"
              value={parseIsoCalendarDate(draft.deliveryDate) ?? new Date()}
            />
          </View>
          <Field
            accessibilityLabel="Endereço de entrega"
            disabled={pending}
            label="Endereço de entrega"
            multiline
            onChangeText={(value) => onChange('deliveryAddressSnapshot', value)}
            placeholder="Endereço de entrega"
            value={draft.deliveryAddressSnapshot}
          />
        </PremiumCard>
      </PremiumSection>

      <PremiumSection title="Informações">
        <PremiumCard style={[styles.card, { gap: theme.spacing.md }]}>
          <Field
            accessibilityLabel="Ocasião"
            disabled={pending}
            label="Ocasião"
            onChangeText={(value) => onChange('occasion', value)}
            placeholder="Ex.: aniversário"
            value={draft.occasion}
          />
          <Field
            accessibilityLabel="Destinatário"
            disabled={pending}
            label="Destinatário"
            onChangeText={(value) => onChange('recipient', value)}
            placeholder="Nome do destinatário"
            value={draft.recipient}
          />
          <Field
            accessibilityLabel="Observações"
            disabled={pending}
            label="Observações"
            multiline
            onChangeText={(value) => onChange('notes', value)}
            placeholder="Observações do pedido"
            value={draft.notes}
          />
        </PremiumCard>
      </PremiumSection>

      <PremiumSection title="Valores">
        <PremiumCard style={[styles.card, { gap: theme.spacing.md }]}>
          {hasPostedPayments ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              Valores financeiros exigem anular os pagamentos registrados antes da alteração.
            </Text>
          ) : null}
          <Field
            accessibilityLabel="Desconto"
            disabled={financialDisabled}
            keyboardType="decimal-pad"
            label="Desconto (R$)"
            onChangeText={(value) => onChange('discount', value)}
            placeholder="R$ 0,00"
            value={draft.discount}
          />
          <Field
            accessibilityLabel="Taxa de entrega"
            disabled={financialDisabled}
            keyboardType="decimal-pad"
            label="Taxa de entrega (R$)"
            onChangeText={(value) => onChange('deliveryFee', value)}
            placeholder="R$ 0,00"
            value={draft.deliveryFee}
          />
          <Field
            accessibilityLabel="Custo de entrega"
            disabled={financialDisabled}
            keyboardType="decimal-pad"
            label="Custo de entrega (R$)"
            onChangeText={(value) => onChange('deliveryCost', value)}
            placeholder="R$ 0,00"
            value={draft.deliveryCost}
          />
        </PremiumCard>
      </PremiumSection>

      {paymentError ? <InlineError message={`Pagamentos: ${paymentError}`} /> : null}
      {error ? <InlineError message={error} /> : null}
      {pending ? <Loading label="Salvando alterações…" /> : null}
      <NativeButton
        accessibilityLabel="Salvar alterações"
        disabled={pending}
        haptic="light"
        label="Salvar alterações"
        onPress={onSave}
        variant="primary"
      />
    </View>
  );
}

function Field({
  accessibilityLabel,
  disabled,
  keyboardType,
  label,
  multiline,
  onChangeText,
  placeholder,
  value,
}: {
  accessibilityLabel: string;
  disabled: boolean;
  keyboardType?: 'decimal-pad' | 'default';
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.field}>
      <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
      <NativeTextField
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%' },
  dateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  field: { gap: 4 },
  sections: { width: '100%' },
});
