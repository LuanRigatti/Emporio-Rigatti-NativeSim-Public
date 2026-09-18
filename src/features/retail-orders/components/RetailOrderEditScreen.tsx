import { useIsFocused, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState, ErrorState, InlineError, Loading } from '@/components/feedback';
import { NativeGlassHeader } from '@/components/layout';
import {
  NativeButton,
  NativeDatePicker,
  NativeDropdown,
  NativeTextField,
} from '@/components/native';
import { PremiumCard, PremiumScreen, PremiumSection } from '@/components/premium';
import { useRetailOrderCatalog } from '@/hooks/useRetailOrderCatalog';
import { useRetailOrderDetail } from '@/hooks/useRetailOrderDetail';
import { useRetailOrderEdit } from '@/hooks/useRetailOrderEdit';
import { useRetailOrderPayments } from '@/hooks/useRetailOrderPayments';
import { useAuth } from '@/providers';
import {
  retailOrderDataSource,
  retailOrderHistoryFinancialSummaryService,
  type RetailOrderLineItemEditInput,
} from '@/services/retail-orders';
import { normalizeRetailMoney, normalizeRetailQuantity } from '@/services/retail-costs';
import type { RetailOrder, RetailOrderPatch, RetailProduct } from '@/types/data';
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
  lineItems: readonly RetailOrderEditLineDraft[];
};

type RetailOrderEditLineDraft = {
  productId: string;
  quantity: string;
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
    lineItems: order.lineItems.map((lineItem) => ({
      productId: lineItem.productId,
      quantity: String(lineItem.quantity),
    })),
    notes: order.notes ?? '',
    occasion: order.occasion ?? '',
    orderId: order.orderId,
    recipient: order.recipient ?? '',
  };
}

function buildLineItemInputs(draft: RetailOrderEditDraft): readonly RetailOrderLineItemEditInput[] {
  return draft.lineItems.map((lineItem) => ({
    productId: lineItem.productId,
    quantity: normalizeRetailQuantity(lineItem.quantity, 'A quantidade do produto'),
  }));
}

function lineItemsChanged(
  order: RetailOrder,
  lineItems: readonly RetailOrderLineItemEditInput[],
): boolean {
  if (order.lineItems.length !== lineItems.length) return true;
  return order.lineItems.some((lineItem, index) => {
    const next = lineItems[index];
    return !next || lineItem.productId !== next.productId || lineItem.quantity !== next.quantity;
  });
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
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { sessionVersion, user } = useAuth();
  const detail = useRetailOrderDetail(orderId);
  const paymentState = useRetailOrderPayments(orderId);
  const edit = useRetailOrderEdit(orderId);
  const catalog = useRetailOrderCatalog();
  const [draft, setDraft] = useState<RetailOrderEditDraft>();
  const [preparingLineItems, setPreparingLineItems] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [validationError, setValidationError] = useState<string>();
  const isMountedRef = useRef(true);
  const isFocusedRef = useRef(isFocused);
  const didNavigateBackRef = useRef(false);

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const navigateBackIfActive = useCallback(() => {
    if (
      !isMountedRef.current ||
      !isFocusedRef.current ||
      didNavigateBackRef.current ||
      !navigation.canGoBack()
    ) {
      return;
    }
    didNavigateBackRef.current = true;
    router.back();
  }, [navigation, router]);

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

  const updateLineQuantity = useCallback(
    (productId: string, quantity: string) => {
      setDraft((current) =>
        current
          ? {
              ...current,
              lineItems: current.lineItems.map((lineItem) =>
                lineItem.productId === productId ? { ...lineItem, quantity } : lineItem,
              ),
            }
          : current,
      );
      setValidationError(undefined);
      edit.clearError();
    },
    [edit],
  );

  const removeLine = useCallback(
    (productId: string) => {
      setDraft((current) => {
        if (!current || current.lineItems.length <= 1) return current;
        return {
          ...current,
          lineItems: current.lineItems.filter((lineItem) => lineItem.productId !== productId),
        };
      });
      setValidationError(undefined);
      edit.clearError();
    },
    [edit],
  );

  const addProduct = useCallback(() => {
    if (!selectedProductId) {
      setValidationError('Selecione um produto ativo para adicionar.');
      return;
    }
    const product = catalog.products.find((candidate) => candidate.productId === selectedProductId);
    if (!product || !product.active) {
      setValidationError('O produto selecionado não está disponível para inclusão.');
      return;
    }
    setDraft((current) => {
      if (!current) return current;
      const existing = current.lineItems.find(
        (lineItem) => lineItem.productId === product.productId,
      );
      if (!existing) {
        return {
          ...current,
          lineItems: [...current.lineItems, { productId: product.productId, quantity: '1' }],
        };
      }
      const quantity = normalizeRetailQuantity(existing.quantity, 'A quantidade do produto');
      return {
        ...current,
        lineItems: current.lineItems.map((lineItem) =>
          lineItem.productId === product.productId
            ? { ...lineItem, quantity: String(quantity + 1) }
            : lineItem,
        ),
      };
    });
    setSelectedProductId('');
    setValidationError(undefined);
    edit.clearError();
  }, [catalog.products, edit, selectedProductId]);

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

    let nextLineItems: readonly RetailOrderLineItemEditInput[];
    let contentsChanged = false;
    try {
      nextLineItems = buildLineItemInputs(draft);
      contentsChanged = lineItemsChanged(detail.order, nextLineItems);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Informe quantidades válidas.');
      return;
    }

    if (!Object.keys(prepared.patch).length && !contentsChanged) {
      navigateBackIfActive();
      return;
    }

    let saved: boolean;
    if (contentsChanged) {
      const newProductIds = nextLineItems
        .map((lineItem) => lineItem.productId)
        .filter(
          (productId) => !detail.order!.lineItems.some((line) => line.productId === productId),
        );
      setPreparingLineItems(true);
      try {
        const catalogContext = newProductIds.length
          ? await catalog.prepareForOrder(newProductIds)
          : undefined;
        saved = await edit.saveContents(prepared.patch, nextLineItems, catalogContext);
      } catch (error) {
        if (isMountedRef.current) {
          setValidationError(
            error instanceof Error ? error.message : 'Não foi possível preparar os produtos.',
          );
        }
        return;
      } finally {
        if (isMountedRef.current) setPreparingLineItems(false);
      }
    } else {
      saved = await edit.save(prepared.patch);
    }
    if (!saved) return;

    if (
      (prepared.financialChanged || contentsChanged) &&
      user?.id &&
      paymentState.snapshot !== null
    ) {
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

    navigateBackIfActive();
  }, [
    catalog,
    detail.order,
    draft,
    edit,
    navigateBackIfActive,
    paymentState,
    sessionVersion,
    user,
  ]);

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
      onAddProduct={addProduct}
      onChange={updateDraft}
      onChangeLineQuantity={updateLineQuantity}
      onRemoveLine={removeLine}
      onSave={() => void handleSave()}
      pending={edit.pending || preparingLineItems}
      paymentError={paymentState.error}
      products={catalog.products}
      selectedProductId={selectedProductId}
      onSelectedProductIdChange={setSelectedProductId}
      catalogError={catalog.error}
      order={detail.order}
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
  onAddProduct,
  onChange,
  onChangeLineQuantity,
  onRemoveLine,
  onSave,
  pending,
  paymentError,
  products,
  selectedProductId,
  onSelectedProductIdChange,
  catalogError,
  order,
  theme,
}: {
  draft: RetailOrderEditDraft;
  error?: string;
  hasPostedPayments: boolean;
  onAddProduct: () => void;
  onChange: <K extends keyof Omit<RetailOrderEditDraft, 'orderId'>>(
    key: K,
    value: RetailOrderEditDraft[K],
  ) => void;
  onChangeLineQuantity: (productId: string, quantity: string) => void;
  onRemoveLine: (productId: string) => void;
  onSave: () => void;
  pending: boolean;
  paymentError?: string;
  products: readonly RetailProduct[];
  selectedProductId: string;
  onSelectedProductIdChange: (productId: string) => void;
  catalogError?: string;
  order: RetailOrder;
  theme: ReturnType<typeof useAppTheme>['theme'];
}) {
  const financialDisabled = pending || hasPostedPayments;
  return (
    <View style={[styles.sections, { gap: theme.spacing.xl }]}>
      <PremiumSection title="Produtos">
        <PremiumCard style={[styles.card, { gap: theme.spacing.md }]}>
          {hasPostedPayments ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              Produtos não podem ser alterados enquanto existir pagamento registrado.
            </Text>
          ) : null}
          <NativeDropdown
            accessibilityLabel="Produto para adicionar"
            disabled={pending || hasPostedPayments}
            items={products.map((product) => ({
              label: product.productName,
              value: product.productId,
            }))}
            label={
              products.find((product) => product.productId === selectedProductId)?.productName ??
              'Adicionar produto'
            }
            onValueChange={onSelectedProductIdChange}
            selectedValue={selectedProductId}
          />
          <NativeButton
            disabled={pending || hasPostedPayments || !selectedProductId}
            haptic="light"
            label="Adicionar produto"
            onPress={onAddProduct}
            variant="glass"
          />
          {catalogError ? <InlineError message={`Catálogo: ${catalogError}`} /> : null}
          <View style={styles.lines}>
            {draft.lineItems.map((lineItem) => {
              const originalLine = order.lineItems.find(
                (candidate) => candidate.productId === lineItem.productId,
              );
              const currentProduct = products.find(
                (product) => product.productId === lineItem.productId,
              );
              const name =
                originalLine?.productNameSnapshot ??
                currentProduct?.productName ??
                lineItem.productId;
              const details = originalLine
                ? [
                    originalLine.categorySnapshot,
                    originalLine.variantSnapshot,
                    originalLine.flavorSnapshot,
                    originalLine.packageSizeSnapshot,
                  ]
                    .map((value) => value?.trim())
                    .filter(Boolean)
                    .join(' · ')
                : [
                    currentProduct?.categoryName,
                    currentProduct?.variant,
                    currentProduct?.flavor,
                    currentProduct?.packageSize,
                  ]
                    .map((value) => value?.trim())
                    .filter(Boolean)
                    .join(' · ');
              return (
                <View key={lineItem.productId} style={styles.lineCard}>
                  <View style={styles.lineCopy}>
                    <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                      {name}
                    </Text>
                    {details ? (
                      <Text
                        style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
                      >
                        {details}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.lineControls}>
                    <View style={styles.quantityField}>
                      <Field
                        accessibilityLabel={`Quantidade de ${name}`}
                        disabled={pending || hasPostedPayments}
                        keyboardType="decimal-pad"
                        label="Quantidade"
                        onChangeText={(value) => onChangeLineQuantity(lineItem.productId, value)}
                        placeholder="1"
                        value={lineItem.quantity}
                      />
                    </View>
                    <NativeButton
                      accessibilityLabel={`Remover ${name}`}
                      destructive
                      disabled={pending || hasPostedPayments || draft.lineItems.length <= 1}
                      fallbackIcon="trash-outline"
                      haptic="light"
                      label="Remover"
                      onPress={() => onRemoveLine(lineItem.productId)}
                      systemImage="trash"
                      variant="glass"
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </PremiumCard>
      </PremiumSection>

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
  field: { gap: 4, width: '100%' },
  lineCard: { gap: 12, padding: 12 },
  lineControls: { alignItems: 'flex-end', flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  lineCopy: { gap: 4, width: '100%' },
  lines: { gap: 8 },
  quantityField: { flex: 1, minWidth: 140 },
  sections: { width: '100%' },
});
