import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeButton,
  NativeDatePicker,
  NativeDialog,
  NativeDropdown,
  NativeSheet,
  NativeTextField,
  type NativeTextFieldProps,
} from '@/components/native';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { useRetailOrderCatalog } from '@/hooks/useRetailOrderCatalog';
import { useRetailOrderPayments } from '@/hooks/useRetailOrderPayments';
import { useRetailOrders } from '@/hooks/useRetailOrders';
import {
  buildRetailInitialPaymentDraft,
  buildRetailOrderCreateInput,
  calculateRetailOrderDraftTotals,
  RETAIL_PAYMENT_METHOD_OPTIONS,
  type RetailInitialPaymentValues,
  type RetailOrderDraftTotals,
  type RetailOrderDraftValues,
} from '@/services/retail-orders';
import type {
  RetailOrderCreateInput,
  RetailPaymentDraft,
  RetailPaymentMethod,
  RetailProduct,
} from '@/types/data';
import { formatCurrency, parseIsoCalendarDate, todayIso } from '@/utils/data';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { getCardSurfaceColor, useAppTheme } from '@/theme';

type RetailOrderStep = 'client' | 'products' | 'details' | 'summary' | 'payment';

const STEP_TITLES: Record<RetailOrderStep, string> = {
  client: 'Cliente',
  details: 'Detalhes do pedido',
  payment: 'Pagamento inicial',
  products: 'Produtos',
  summary: 'Resumo',
};

function createInitialDraft(): RetailOrderDraftValues {
  const date = todayIso();
  return {
    clientId: '',
    deliveryAddressSnapshot: '',
    deliveryCost: '0',
    deliveryDate: date,
    deliveryFee: '0',
    discount: '0',
    lineItems: [],
    occasion: '',
    notes: '',
    orderDate: date,
    recipient: '',
  };
}

function createInitialPaymentValues(): RetailInitialPaymentValues {
  return {
    amount: '',
    cardFee: '',
    method: 'Pix',
    notes: '',
    paidAt: todayIso(),
  };
}

function OrderTextField({
  accessibilityLabel,
  label,
  ...props
}: Omit<NativeTextFieldProps, 'label'> & { label: string }) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.field}>
      <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
      <NativeTextField
        {...props}
        accessibilityLabel={accessibilityLabel ?? label}
        label={undefined}
      />
    </View>
  );
}

function formatProductDetails(product: RetailProduct, categoryLabel?: string): string {
  return [
    categoryLabel ?? product.categoryName,
    product.variant,
    product.flavor,
    product.packageSize,
  ]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' · ');
}

function findProduct(products: readonly RetailProduct[], productId: string): RetailProduct | null {
  return products.find((product) => product.productId === productId) ?? null;
}

function formatError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function RetailOrderRegistrarScreen() {
  const { resolvedMode, theme } = useAppTheme();
  const router = useRouter();
  const catalog = useRetailOrderCatalog();
  const { create } = useRetailOrders();
  const { registerForOrder } = useRetailOrderPayments();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [step, setStep] = useState<RetailOrderStep>('client');
  const [draft, setDraft] = useState<RetailOrderDraftValues>(createInitialDraft);
  const [paymentValues, setPaymentValues] = useState<RetailInitialPaymentValues>(
    createInitialPaymentValues,
  );
  const [selectedProductId, setSelectedProductId] = useState('');
  const [deliveryAddressEdited, setDeliveryAddressEdited] = useState(false);
  const [deliveryFeeEdited, setDeliveryFeeEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);

  const activeClients = catalog.clients.filter((client) => client.active);
  const activeProducts = catalog.products.filter((product) => product.active);
  const categoryById = useMemo(
    () => new Map(catalog.categories.map((category) => [category.categoryId, category.label])),
    [catalog.categories],
  );
  const selectedClient = activeClients.find((client) => client.clientId === draft.clientId);
  const draftTotals = useMemo<RetailOrderDraftTotals | null>(() => {
    try {
      return calculateRetailOrderDraftTotals({
        deliveryFee: draft.deliveryFee,
        discount: draft.discount,
        lineItems: draft.lineItems,
        products: activeProducts,
      });
    } catch {
      return null;
    }
  }, [activeProducts, draft.deliveryFee, draft.discount, draft.lineItems]);
  const productOptions = useMemo(
    () => [
      { label: 'Selecione um produto', value: '' },
      ...activeProducts.map((product) => ({
        label: `${product.productName}${
          formatProductDetails(product, categoryById.get(product.categoryId))
            ? ` · ${formatProductDetails(product, categoryById.get(product.categoryId))}`
            : ''
        }`,
        value: product.productId,
      })),
    ],
    [activeProducts, categoryById],
  );
  const selectedProductLabel =
    productOptions.find((option) => option.value === selectedProductId)?.label ??
    'Adicionar produto';
  const selectedPaymentLabel =
    RETAIL_PAYMENT_METHOD_OPTIONS.find((option) => option.value === paymentValues.method)?.label ??
    'Forma de pagamento';
  const productById = useMemo(
    () => new Map(activeProducts.map((product) => [product.productId, product])),
    [activeProducts],
  );
  const hasData = activeClients.length > 0 && activeProducts.length > 0;

  const updateDraft = useCallback(
    <K extends keyof RetailOrderDraftValues>(key: K, value: RetailOrderDraftValues[K]) => {
      setDraft((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const updatePayment = useCallback(
    <K extends keyof RetailInitialPaymentValues>(key: K, value: RetailInitialPaymentValues[K]) => {
      setPaymentValues((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const resetFlow = useCallback(() => {
    setDraft(createInitialDraft());
    setPaymentValues(createInitialPaymentValues());
    setSelectedProductId('');
    setDeliveryAddressEdited(false);
    setDeliveryFeeEdited(false);
    setStep('client');
    setError(undefined);
    setPendingOrderId(null);
  }, []);

  const openSheet = useCallback(() => {
    if (!hasData || submitting) return;
    triggerLightImpactHaptic();
    resetFlow();
    setSheetVisible(true);
  }, [hasData, resetFlow, submitting]);

  const handleVisibleChange = useCallback((visible: boolean) => {
    setSheetVisible(visible);
    if (!visible) setError(undefined);
  }, []);

  const handleClientChange = useCallback(
    (clientId: string) => {
      const client = activeClients.find((candidate) => candidate.clientId === clientId);
      if (!client) return;
      setDraft((current) => ({
        ...current,
        clientId,
        ...(deliveryAddressEdited ? {} : { deliveryAddressSnapshot: client.address ?? '' }),
        ...(deliveryFeeEdited ? {} : { deliveryFee: String(client.defaultDeliveryFee ?? 0) }),
      }));
      setError(undefined);
    },
    [activeClients, deliveryAddressEdited, deliveryFeeEdited],
  );

  const handleAddProduct = useCallback(() => {
    if (!selectedProductId) {
      setError('Selecione um produto para adicionar.');
      return;
    }
    const product = findProduct(activeProducts, selectedProductId);
    if (!product) {
      setError('O produto selecionado não está mais disponível.');
      return;
    }
    setDraft((current) => {
      const existing = current.lineItems.find((line) => line.productId === selectedProductId);
      if (!existing) {
        return {
          ...current,
          lineItems: [...current.lineItems, { productId: selectedProductId, quantity: '1' }],
        };
      }
      const nextQuantity = Number(existing.quantity.replace(',', '.'));
      if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) return current;
      return {
        ...current,
        lineItems: current.lineItems.map((line) =>
          line.productId === selectedProductId
            ? { ...line, quantity: String(nextQuantity + 1) }
            : line,
        ),
      };
    });
    setSelectedProductId('');
    setError(undefined);
  }, [activeProducts, selectedProductId]);

  const updateLineQuantity = useCallback((productId: string, quantity: string) => {
    setDraft((current) => ({
      ...current,
      lineItems: current.lineItems.map((line) =>
        line.productId === productId ? { ...line, quantity } : line,
      ),
    }));
  }, []);

  const removeLine = useCallback((productId: string) => {
    setDraft((current) => ({
      ...current,
      lineItems: current.lineItems.filter((line) => line.productId !== productId),
    }));
  }, []);

  const goToProducts = useCallback(() => {
    if (!selectedClient) {
      setError('Selecione um cliente Varejo.');
      return;
    }
    Keyboard.dismiss();
    setError(undefined);
    setStep('products');
  }, [selectedClient]);

  const goToDetails = useCallback(() => {
    try {
      calculateRetailOrderDraftTotals({
        deliveryFee: draft.deliveryFee,
        discount: '0',
        lineItems: draft.lineItems,
        products: activeProducts,
      });
      Keyboard.dismiss();
      setError(undefined);
      setStep('details');
    } catch (detailsError) {
      setError(formatError(detailsError, 'Revise os produtos selecionados.'));
    }
  }, [activeProducts, draft.deliveryFee, draft.lineItems]);

  const goToSummary = useCallback(() => {
    try {
      buildRetailOrderCreateInput(draft, selectedClient, activeProducts);
      Keyboard.dismiss();
      setError(undefined);
      setStep('summary');
    } catch (summaryError) {
      setError(formatError(summaryError, 'Revise os valores do pedido.'));
    }
  }, [activeProducts, draft, selectedClient]);

  const submitOrder = useCallback(
    async (withPayment: boolean) => {
      if (submitting) return;
      let orderInput: RetailOrderCreateInput;
      let paymentDraft: RetailPaymentDraft | undefined;
      try {
        if (!draftTotals) throw new Error('Revise os produtos, desconto e entrega do pedido.');
        orderInput = buildRetailOrderCreateInput(draft, selectedClient, activeProducts);
        paymentDraft = withPayment
          ? buildRetailInitialPaymentDraft(paymentValues, draftTotals.totalCharged)
          : undefined;
        if (withPayment && !paymentDraft) {
          throw new Error('Informe o valor do pagamento inicial.');
        }
      } catch (validationError) {
        setError(formatError(validationError, 'Revise os dados do pedido.'));
        return;
      }

      setSubmitting(true);
      setError(undefined);
      Keyboard.dismiss();
      let orderWasCreated = false;
      try {
        let orderId = pendingOrderId;
        if (!orderId) {
          const orderCatalog = await catalog.prepareForOrder(
            orderInput.lineItems.map((lineItem) => lineItem.productId),
          );
          orderId = await create(orderInput, orderCatalog);
          orderWasCreated = true;
          setPendingOrderId(orderId);
        }
        if (paymentDraft) {
          await registerForOrder(orderId, paymentDraft);
        }
        setSheetVisible(false);
        resetFlow();
        setSuccessVisible(true);
      } catch (submitError) {
        setError(
          orderWasCreated || pendingOrderId
            ? `O pedido foi criado, mas o pagamento não foi registrado. ${formatError(
                submitError,
                'Tente novamente.',
              )}`
            : formatError(submitError, 'Não foi possível criar o pedido.'),
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      activeProducts,
      catalog,
      create,
      draft,
      draftTotals,
      paymentValues,
      pendingOrderId,
      registerForOrder,
      resetFlow,
      selectedClient,
      submitting,
    ],
  );

  const header = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      titleStyle={{
        fontFamily: 'System',
        fontSize: 36,
        fontWeight: '700',
        marginLeft: -(theme.spacing.xxs * 2),
      }}
      title="Registrar"
    />
  );

  const cardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const renderGuide = (kind: 'clients' | 'products') => {
    const clientsGuide = kind === 'clients';
    return (
      <PremiumCard
        style={[
          styles.guideCard,
          {
            backgroundColor: cardSurface,
            borderRadius: theme.radius.xl + theme.spacing.md,
            padding: theme.spacing.lg,
          },
        ]}
      >
        <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
          {clientsGuide ? 'Cadastre um cliente Varejo' : 'Cadastre um produto Varejo'}
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          {clientsGuide
            ? 'Selecione um cliente antes de criar um pedido.'
            : 'Adicione produtos ativos ao catálogo antes de criar um pedido.'}
        </Text>
        <NativeButton
          accessibilityLabel={
            clientsGuide ? 'Cadastrar cliente Varejo' : 'Cadastrar produto Varejo'
          }
          controlSize="large"
          color={theme.colors.contrastContent}
          glassTint={theme.colors.contrastSurface}
          haptic="light"
          label={clientsGuide ? 'Abrir Clientes Varejo' : 'Abrir Catálogo Varejo'}
          onPress={() => {
            triggerLightImpactHaptic();
            router.push(clientsGuide ? '/clientes-varejo' : '/catalogo-varejo');
          }}
          variant="primary"
        />
      </PremiumCard>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <PremiumScreen
        contentContainerStyle={[
          styles.content,
          { marginTop: theme.spacing.xxxl + theme.spacing.xl + 2 },
        ]}
        progressiveBlurHeight={
          theme.spacing.xxxl + theme.spacing.xs * 2 + theme.spacing.xl + theme.spacing.sm
        }
        progressiveBlurTopOffset={0}
        progressiveBlur
      >
        <View style={styles.header}>{header}</View>
        <View style={[styles.body, { marginTop: theme.spacing.md * 2 - theme.spacing.xs / 2 - 4 }]}>
          {catalog.loading ? (
            <PremiumCard style={[styles.card, { backgroundColor: cardSurface }]}>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                Carregando dados do Varejo...
              </Text>
            </PremiumCard>
          ) : catalog.error ? (
            <PremiumCard style={[styles.card, { backgroundColor: cardSurface }]}>
              <Text style={[theme.typography.body, { color: theme.colors.danger }]}>
                {catalog.error}
              </Text>
            </PremiumCard>
          ) : !activeClients.length ? (
            renderGuide('clients')
          ) : !activeProducts.length ? (
            renderGuide('products')
          ) : (
            <PremiumCard
              style={[
                styles.card,
                {
                  backgroundColor: cardSurface,
                  borderRadius: theme.radius.xl + theme.spacing.md,
                  padding: theme.spacing.lg,
                },
              ]}
            >
              <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
                Novo pedido Varejo
              </Text>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                Selecione cliente, produtos e condições da venda.
              </Text>
              <NativeButton
                accessibilityLabel="Criar pedido Varejo"
                controlSize="large"
                haptic="light"
                label="Novo pedido"
                onPress={openSheet}
                variant="primary"
              />
            </PremiumCard>
          )}
        </View>
      </PremiumScreen>

      <NativeSheet
        accessibilityLabel="Novo pedido Varejo"
        detents={['large']}
        onVisibleChange={handleVisibleChange}
        presentationBackgroundInteraction="disabled"
        title="Novo pedido Varejo"
        visible={sheetVisible}
      >
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[styles.sheetContent, { paddingBottom: theme.spacing.xl }]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.sheetScroll}
        >
          <View style={styles.sheetHeader}>
            <Text style={[theme.typography.title2, { color: theme.colors.textPrimary }]}>
              {STEP_TITLES[step]}
            </Text>
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              Etapa {['client', 'products', 'details', 'summary', 'payment'].indexOf(step) + 1} de 5
            </Text>
          </View>

          {error ? (
            <Text
              accessibilityRole="alert"
              style={[theme.typography.footnote, { color: theme.colors.danger }]}
            >
              {error}
            </Text>
          ) : null}

          {step === 'client' ? (
            <>
              <NativeDropdown
                accessibilityLabel="Cliente Varejo"
                disabled={submitting || !activeClients.length}
                items={activeClients.map((client) => ({
                  label: client.name,
                  value: client.clientId,
                }))}
                label={selectedClient?.name ?? 'Cliente Varejo'}
                onValueChange={handleClientChange}
                selectedValue={draft.clientId}
              />
              {selectedClient ? (
                <View style={styles.selectedSummary}>
                  <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                    {selectedClient.name}
                  </Text>
                  {selectedClient.phone ? (
                    <Text
                      style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
                    >
                      {selectedClient.phone}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              <NativeButton
                controlSize="large"
                disabled={submitting || !selectedClient}
                haptic="light"
                label="Continuar"
                onPress={goToProducts}
                variant="primary"
              />
            </>
          ) : null}

          {step === 'products' ? (
            <>
              <NativeDropdown
                accessibilityLabel="Produto Varejo"
                disabled={submitting || !activeProducts.length}
                items={productOptions}
                label={selectedProductLabel}
                onValueChange={setSelectedProductId}
                selectedValue={selectedProductId}
              />
              <NativeButton
                controlSize="regular"
                disabled={submitting || !selectedProductId}
                haptic="light"
                label="Adicionar produto"
                onPress={handleAddProduct}
                variant="glass"
              />
              {draft.lineItems.length ? (
                <View style={styles.lines}>
                  {draft.lineItems.map((line) => {
                    const product = productById.get(line.productId);
                    if (!product) return null;
                    const details = formatProductDetails(
                      product,
                      categoryById.get(product.categoryId),
                    );
                    return (
                      <View key={line.productId} style={styles.lineCard}>
                        <View style={styles.lineCopy}>
                          <Text
                            style={[theme.typography.body, { color: theme.colors.textPrimary }]}
                          >
                            {product.productName}
                          </Text>
                          {details ? (
                            <Text
                              style={[
                                theme.typography.footnote,
                                { color: theme.colors.textSecondary },
                              ]}
                            >
                              {details}
                            </Text>
                          ) : null}
                        </View>
                        <OrderTextField
                          accessibilityLabel={`Quantidade de ${product.productName}`}
                          disabled={submitting}
                          keyboardType="decimal-pad"
                          label="Quantidade"
                          onChangeText={(value) => updateLineQuantity(line.productId, value)}
                          placeholder="1"
                          value={line.quantity}
                        />
                        <NativeButton
                          accessibilityLabel={`Remover ${product.productName}`}
                          disabled={submitting}
                          destructive
                          fallbackIcon="trash-outline"
                          haptic="light"
                          label="Remover"
                          onPress={() => removeLine(line.productId)}
                          systemImage="trash"
                          variant="glass"
                        />
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                  Nenhum produto adicionado.
                </Text>
              )}
              <View style={styles.navigationRow}>
                <NativeButton
                  disabled={submitting}
                  fallbackIcon="chevron-back"
                  haptic="light"
                  label="Voltar"
                  onPress={() => {
                    setError(undefined);
                    setStep('client');
                  }}
                  systemImage="chevron.left"
                  variant="glass"
                />
                <NativeButton
                  controlSize="large"
                  disabled={submitting || !draft.lineItems.length}
                  haptic="light"
                  label="Continuar"
                  onPress={goToDetails}
                  variant="primary"
                />
              </View>
            </>
          ) : null}

          {step === 'details' ? (
            <>
              <View style={styles.dateRow}>
                <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                  Data do pedido
                </Text>
                <NativeDatePicker
                  accessibilityLabel="Data do pedido"
                  mode="date"
                  onChange={(date) => updateDraft('orderDate', todayIso(date))}
                  style="compact"
                  value={parseIsoCalendarDate(draft.orderDate) ?? new Date()}
                />
              </View>
              <View style={styles.dateRow}>
                <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                  Data de entrega
                </Text>
                <NativeDatePicker
                  accessibilityLabel="Data de entrega"
                  mode="date"
                  onChange={(date) => updateDraft('deliveryDate', todayIso(date))}
                  style="compact"
                  value={parseIsoCalendarDate(draft.deliveryDate) ?? new Date()}
                />
              </View>
              <OrderTextField
                accessibilityLabel="Endereço de entrega"
                disabled={submitting}
                label="Endereço de entrega"
                multiline
                onChangeText={(value) => {
                  setDeliveryAddressEdited(true);
                  updateDraft('deliveryAddressSnapshot', value);
                }}
                placeholder="Endereço (opcional para retirada)"
                value={draft.deliveryAddressSnapshot}
              />
              <OrderTextField
                accessibilityLabel="Ocasião"
                disabled={submitting}
                label="Ocasião (opcional)"
                onChangeText={(value) => updateDraft('occasion', value)}
                placeholder="Ex.: aniversário"
                value={draft.occasion}
              />
              <OrderTextField
                accessibilityLabel="Destinatário"
                disabled={submitting}
                label="Destinatário (opcional)"
                onChangeText={(value) => updateDraft('recipient', value)}
                placeholder="Nome do presenteado"
                value={draft.recipient}
              />
              <OrderTextField
                accessibilityLabel="Desconto"
                disabled={submitting}
                keyboardType="decimal-pad"
                label="Desconto"
                onChangeText={(value) => updateDraft('discount', value)}
                placeholder="R$ 0,00"
                value={draft.discount}
              />
              <OrderTextField
                accessibilityLabel="Taxa de entrega cobrada"
                disabled={submitting}
                keyboardType="decimal-pad"
                label="Taxa de entrega cobrada"
                onChangeText={(value) => {
                  setDeliveryFeeEdited(true);
                  updateDraft('deliveryFee', value);
                }}
                placeholder="R$ 0,00"
                value={draft.deliveryFee}
              />
              <OrderTextField
                accessibilityLabel="Custo real da entrega"
                disabled={submitting}
                keyboardType="decimal-pad"
                label="Custo real da entrega"
                onChangeText={(value) => updateDraft('deliveryCost', value)}
                placeholder="R$ 0,00"
                value={draft.deliveryCost}
              />
              <OrderTextField
                accessibilityLabel="Observações"
                disabled={submitting}
                label="Observações (opcional)"
                multiline
                onChangeText={(value) => updateDraft('notes', value)}
                placeholder="Observações do pedido"
                value={draft.notes}
              />
              <View style={styles.navigationRow}>
                <NativeButton
                  disabled={submitting}
                  fallbackIcon="chevron-back"
                  haptic="light"
                  label="Voltar"
                  onPress={() => {
                    setError(undefined);
                    setStep('products');
                  }}
                  systemImage="chevron.left"
                  variant="glass"
                />
                <NativeButton
                  controlSize="large"
                  disabled={submitting}
                  haptic="light"
                  label="Ver resumo"
                  onPress={goToSummary}
                  variant="primary"
                />
              </View>
            </>
          ) : null}

          {step === 'summary' ? (
            <>
              <View style={styles.summaryBlock}>
                <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                  Cliente: {selectedClient?.name ?? 'não selecionado'}
                </Text>
                {draft.lineItems.map((line) => {
                  const product = productById.get(line.productId);
                  const lineTotal = draftTotals?.lines.find(
                    (totalLine) => totalLine.productId === line.productId,
                  );
                  return product && lineTotal ? (
                    <View key={line.productId} style={styles.summaryRow}>
                      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                        {product.productName} × {lineTotal.quantity}
                      </Text>
                      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                        {formatCurrency(lineTotal.lineSubtotal)}
                      </Text>
                    </View>
                  ) : null;
                })}
                <View style={styles.summaryRow}>
                  <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                    Subtotal
                  </Text>
                  <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                    {formatCurrency(draftTotals?.subtotalProducts ?? 0)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                    Desconto
                  </Text>
                  <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                    {formatCurrency(draftTotals?.discount ?? 0)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                    Entrega
                  </Text>
                  <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                    {formatCurrency(draftTotals?.deliveryFee ?? 0)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                    Total cobrado
                  </Text>
                  <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                    {formatCurrency(draftTotals?.totalCharged ?? 0)}
                  </Text>
                </View>
              </View>
              <View style={styles.navigationRow}>
                <NativeButton
                  disabled={submitting}
                  fallbackIcon="chevron-back"
                  haptic="light"
                  label="Voltar"
                  onPress={() => {
                    setError(undefined);
                    setStep('details');
                  }}
                  systemImage="chevron.left"
                  variant="glass"
                />
                <NativeButton
                  controlSize="large"
                  disabled={submitting || !draftTotals}
                  haptic="light"
                  label="Continuar"
                  onPress={() => {
                    setError(undefined);
                    setStep('payment');
                  }}
                  variant="primary"
                />
              </View>
            </>
          ) : null}

          {step === 'payment' ? (
            <>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                Você pode deixar o pedido em aberto ou registrar um pagamento inicial.
              </Text>
              <OrderTextField
                accessibilityLabel="Valor do pagamento inicial"
                disabled={submitting}
                keyboardType="decimal-pad"
                label="Valor do pagamento inicial (opcional)"
                onChangeText={(value) => updatePayment('amount', value)}
                placeholder="R$ 0,00"
                value={paymentValues.amount}
              />
              <NativeDropdown
                accessibilityLabel="Forma do pagamento inicial"
                disabled={submitting}
                items={RETAIL_PAYMENT_METHOD_OPTIONS}
                label={selectedPaymentLabel}
                onValueChange={(value) => updatePayment('method', value as RetailPaymentMethod)}
                selectedValue={paymentValues.method}
              />
              {paymentValues.method === 'Crédito' || paymentValues.method === 'Débito' ? (
                <OrderTextField
                  accessibilityLabel="Taxa do cartão"
                  disabled={submitting}
                  keyboardType="decimal-pad"
                  label="Taxa do cartão (opcional)"
                  onChangeText={(value) => updatePayment('cardFee', value)}
                  placeholder="R$ 0,00"
                  value={paymentValues.cardFee}
                />
              ) : null}
              <View style={styles.dateRow}>
                <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                  Data do pagamento
                </Text>
                <NativeDatePicker
                  accessibilityLabel="Data do pagamento inicial"
                  mode="date"
                  onChange={(date) => updatePayment('paidAt', todayIso(date))}
                  style="compact"
                  value={parseIsoCalendarDate(paymentValues.paidAt) ?? new Date()}
                />
              </View>
              <OrderTextField
                accessibilityLabel="Observações do pagamento inicial"
                disabled={submitting}
                label="Observações do pagamento (opcional)"
                onChangeText={(value) => updatePayment('notes', value)}
                placeholder="Observação"
                value={paymentValues.notes}
              />
              <NativeButton
                disabled={submitting}
                haptic="light"
                label="Sem pagamento agora"
                onPress={() => void submitOrder(false)}
                variant="glass"
              />
              <NativeButton
                controlSize="large"
                disabled={submitting}
                haptic="light"
                label={pendingOrderId ? 'Tentar registrar pagamento' : 'Confirmar pedido'}
                onPress={() => void submitOrder(true)}
                variant="primary"
              />
              <NativeButton
                disabled={submitting}
                fallbackIcon="chevron-back"
                haptic="light"
                label="Voltar"
                onPress={() => {
                  setError(undefined);
                  setStep('summary');
                }}
                systemImage="chevron.left"
                variant="glass"
              />
            </>
          ) : null}
        </ScrollView>
      </NativeSheet>
      <NativeDialog
        actions={[{ id: 'ok', onPress: () => setSuccessVisible(false), title: 'OK' }]}
        message="O pedido foi salvo com sucesso."
        onDismiss={() => setSuccessVisible(false)}
        title="Pedido criado"
        visible={successVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16 },
  card: { gap: 12, width: '100%' },
  content: { flexGrow: 1 },
  dateRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  field: { gap: 4, width: '100%' },
  guideCard: { gap: 12, width: '100%' },
  header: { minHeight: 44 },
  lineCard: { gap: 12, paddingVertical: 8 },
  lineCopy: { gap: 2 },
  lines: { gap: 8 },
  navigationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  screen: { flex: 1 },
  selectedSummary: { gap: 2, paddingVertical: 4 },
  sheetContent: { gap: 16, paddingHorizontal: 16, paddingTop: 12 },
  sheetHeader: { gap: 4 },
  sheetScroll: { width: '100%' },
  summaryBlock: { gap: 12 },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
