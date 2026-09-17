import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { Loading } from '@/components/feedback';
import { NativeGlassHeader } from '@/components/layout';
import {
  NativeButton,
  NativeDatePicker,
  NativeDialog,
  NativeDropdown,
  NativeTextField,
  type NativeTextFieldProps,
} from '@/components/native';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { useAppSafeAreaInsets } from '@/providers';
import { formatCurrency, parseIsoCalendarDate, todayIso } from '@/utils/data';
import { getCardSurfaceColor, useAppTheme } from '@/theme';

import {
  type RetailOrderFlowContextValue,
  type RetailOrderFlowStep,
  useRetailOrderFlow,
} from './RetailOrderFlowProvider';

const STEP_ORDER: readonly RetailOrderFlowStep[] = [
  'client',
  'products',
  'details',
  'summary',
  'payment',
];

const STEP_TITLES: Record<RetailOrderFlowStep, string> = {
  client: 'Cliente',
  products: 'Produtos',
  details: 'Detalhes do pedido',
  summary: 'Resumo',
  payment: 'Pagamento inicial',
};

export function RetailOrderStepScreen({ step }: { step: RetailOrderFlowStep }) {
  const { resolvedMode, theme } = useAppTheme();
  const insets = useAppSafeAreaInsets();
  const router = useRouter();
  const flow = useRetailOrderFlow();
  const redirectPath = getSafeRedirectPath(flow, step);
  const header = <NativeGlassHeader mode="transparent" title={STEP_TITLES[step]} />;

  useEffect(() => {
    if (!flow.catalogLoading && redirectPath) router.replace(redirectPath);
  }, [flow.catalogLoading, redirectPath, router]);

  const cardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const isRedirecting = Boolean(redirectPath);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <PremiumScreen
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: theme.layout.tabBarHeight + insets.bottom + theme.spacing.xl,
          },
        ]}
        overlayHeader={header}
        progressiveBlur
      >
        {flow.catalogLoading || isRedirecting ? (
          <PremiumCard
            style={[styles.card, { backgroundColor: cardSurface, marginTop: theme.spacing.md }]}
          >
            <Loading
              label={isRedirecting ? 'Abrindo pedido Varejo...' : 'Carregando dados do Varejo...'}
            />
          </PremiumCard>
        ) : flow.catalogError ? (
          <PremiumCard
            style={[styles.card, { backgroundColor: cardSurface, marginTop: theme.spacing.md }]}
          >
            <Text style={[theme.typography.body, { color: theme.colors.danger }]}>
              {flow.catalogError}
            </Text>
          </PremiumCard>
        ) : (
          <RetailOrderStepCard flow={flow} step={step} />
        )}
      </PremiumScreen>
      {step === 'payment' ? (
        <NativeDialog
          actions={[{ id: 'ok', onPress: () => handleSuccess(flow, router), title: 'OK' }]}
          message="O pedido foi salvo com sucesso."
          onDismiss={() => handleSuccess(flow, router)}
          title="Pedido criado"
          visible={flow.successVisible}
        />
      ) : null}
    </View>
  );
}

function getSafeRedirectPath(
  flow: RetailOrderFlowContextValue,
  step: RetailOrderFlowStep,
): '/registrar-pedido-varejo' | '/registrar-pedido-varejo/produtos' | null {
  if (step !== 'client' && !flow.draft.clientId) return '/registrar-pedido-varejo';
  if (
    (step === 'details' || step === 'summary' || step === 'payment') &&
    !flow.draft.lineItems.length
  ) {
    return '/registrar-pedido-varejo/produtos';
  }
  return null;
}

function handleSuccess(flow: RetailOrderFlowContextValue, router: ReturnType<typeof useRouter>) {
  if (!flow.successVisible) return;
  flow.dismissSuccess();
  router.dismissAll();
}

function RetailOrderStepCard({
  flow,
  step,
}: {
  flow: RetailOrderFlowContextValue;
  step: RetailOrderFlowStep;
}) {
  const { resolvedMode, theme } = useAppTheme();

  return (
    <PremiumCard
      style={[
        styles.card,
        {
          backgroundColor: getCardSurfaceColor(resolvedMode, theme.colors.surface),
          borderRadius: theme.radius.xl + theme.spacing.md,
          gap: theme.spacing.md,
          marginTop: theme.spacing.md,
          padding: theme.spacing.lg,
        },
      ]}
    >
      <View style={styles.stepHeader}>
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          Etapa {STEP_ORDER.indexOf(step) + 1} de {STEP_ORDER.length}
        </Text>
      </View>
      {flow.error ? (
        <Text
          accessibilityRole="alert"
          style={[theme.typography.footnote, { color: theme.colors.danger }]}
        >
          {flow.error}
        </Text>
      ) : null}
      {step === 'client' ? <ClientStep flow={flow} /> : null}
      {step === 'products' ? <ProductsStep flow={flow} /> : null}
      {step === 'details' ? <DetailsStep flow={flow} /> : null}
      {step === 'summary' ? <SummaryStep flow={flow} /> : null}
      {step === 'payment' ? <PaymentStep flow={flow} /> : null}
    </PremiumCard>
  );
}

function ClientStep({ flow }: { flow: RetailOrderFlowContextValue }) {
  const router = useRouter();
  const { theme } = useAppTheme();
  const hasClients = flow.activeClients.length > 0;

  if (!hasClients) {
    return (
      <>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          Cadastre um cliente Varejo antes de criar um pedido.
        </Text>
        <NativeButton
          controlSize="large"
          haptic="light"
          label="Abrir Clientes Varejo"
          onPress={() => router.push('/clientes-varejo')}
          variant="primary"
        />
      </>
    );
  }

  return (
    <>
      <NativeDropdown
        accessibilityLabel="Cliente Varejo"
        disabled={flow.submitting}
        items={flow.activeClients.map((client) => ({
          label: client.name,
          value: client.clientId,
        }))}
        label={flow.selectedClient?.name ?? 'Cliente Varejo'}
        onValueChange={flow.handleClientChange}
        selectedValue={flow.draft.clientId}
      />
      {flow.selectedClient ? (
        <View style={styles.selectedSummary}>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
            {flow.selectedClient.name}
          </Text>
          {flow.selectedClient.phone ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              {flow.selectedClient.phone}
            </Text>
          ) : null}
          {flow.selectedClient.address ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              {flow.selectedClient.address}
            </Text>
          ) : null}
        </View>
      ) : null}
      <NativeButton
        controlSize="large"
        disabled={flow.submitting || !flow.selectedClient}
        haptic="light"
        label="Continuar"
        onPress={() => {
          if (!flow.selectedClient) return;
          flow.clearError();
          Keyboard.dismiss();
          router.push('/registrar-pedido-varejo/produtos');
        }}
        variant="primary"
      />
    </>
  );
}

function ProductsStep({ flow }: { flow: RetailOrderFlowContextValue }) {
  const { theme } = useAppTheme();
  const router = useRouter();
  const selectedProduct = flow.productById.get(flow.selectedProductId);

  return (
    <>
      {!flow.activeProducts.length ? (
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          Cadastre um produto Varejo antes de criar um pedido.
        </Text>
      ) : (
        <>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            Selecionar produto
          </Text>
          <NativeDropdown
            accessibilityLabel="Produto Varejo"
            disabled={flow.submitting || Boolean(flow.validatingProductId)}
            items={flow.productOptions}
            label={flow.selectedProductLabel}
            onValueChange={flow.setSelectedProductId}
            selectedValue={flow.selectedProductId}
          />
          {selectedProduct ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              Selecionado: {selectedProduct.productName}. Adicione-o para incluir no pedido.
            </Text>
          ) : null}
          <NativeButton
            disabled={
              flow.submitting || !flow.selectedProductId || Boolean(flow.validatingProductId)
            }
            haptic="light"
            label={flow.validatingProductId ? 'Validando custo…' : 'Adicionar produto'}
            onPress={() => void flow.handleAddProduct()}
            variant="glass"
          />
        </>
      )}

      <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
        Produtos adicionados
      </Text>
      {flow.draft.lineItems.length ? (
        <View style={styles.lines}>
          {flow.draft.lineItems.map((line) => {
            const product = flow.productById.get(line.productId);
            if (!product) return null;
            const details = [
              flow.categoriesById.get(product.categoryId) ?? product.categoryName,
              product.variant,
              product.flavor,
              product.packageSize,
            ]
              .map((value) => value?.trim())
              .filter(Boolean)
              .join(' · ');
            const lineTotal = flow.draftTotals?.lines.find(
              (totalLine) => totalLine.productId === line.productId,
            );
            const costError = flow.productCostErrors[line.productId];
            return (
              <View
                key={line.productId}
                style={[
                  styles.lineCard,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderRadius: theme.radius.md,
                  },
                ]}
              >
                <View style={styles.lineCopy}>
                  <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                    {product.productName}
                  </Text>
                  {details ? (
                    <Text
                      style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
                    >
                      {details}
                    </Text>
                  ) : null}
                  <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                    Preço unitário:{' '}
                    {lineTotal ? formatCurrency(lineTotal.unitSalePrice) : 'indisponível'}
                  </Text>
                  <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                    Subtotal da linha:{' '}
                    {lineTotal ? formatCurrency(lineTotal.lineSubtotal) : 'indisponível'}
                  </Text>
                  {costError ? (
                    <Text
                      accessibilityRole="alert"
                      style={[theme.typography.footnote, { color: theme.colors.danger }]}
                    >
                      {costError}
                    </Text>
                  ) : null}
                  {flow.validatingProductId === line.productId ? (
                    <Loading label="Validando custo do produto…" tone="info" />
                  ) : null}
                </View>
                <View style={styles.lineControls}>
                  <View style={styles.quantityField}>
                    <OrderTextField
                      accessibilityLabel={`Quantidade de ${product.productName}`}
                      disabled={flow.submitting || Boolean(flow.validatingProductId)}
                      keyboardType="decimal-pad"
                      label="Quantidade"
                      onChangeText={(value) => flow.updateLineQuantity(line.productId, value)}
                      placeholder="1"
                      value={line.quantity}
                    />
                  </View>
                  <NativeButton
                    accessibilityLabel={`Remover ${product.productName}`}
                    disabled={flow.submitting || Boolean(flow.validatingProductId)}
                    destructive
                    fallbackIcon="trash-outline"
                    haptic="light"
                    label="Remover"
                    onPress={() => flow.removeLine(product.productId)}
                    systemImage="trash"
                    variant="glass"
                  />
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          Nenhum produto adicionado.
        </Text>
      )}
      <NativeButton
        controlSize="large"
        disabled={!flow.canContinueProducts}
        haptic="light"
        label="Continuar"
        onPress={async () => {
          if (!(await flow.validateProducts())) return;
          Keyboard.dismiss();
          router.push('/registrar-pedido-varejo/detalhes');
        }}
        variant="primary"
      />
    </>
  );
}

function DetailsStep({ flow }: { flow: RetailOrderFlowContextValue }) {
  const { theme } = useAppTheme();
  const router = useRouter();

  return (
    <>
      <View style={styles.formSection}>
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>Pedido</Text>
        <View style={styles.dateRow}>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
            Data do pedido
          </Text>
          <NativeDatePicker
            accessibilityLabel="Data do pedido"
            mode="date"
            onChange={(date) => flow.updateDraft('orderDate', todayIso(date))}
            style="compact"
            value={parseIsoCalendarDate(flow.draft.orderDate) ?? new Date()}
          />
        </View>
        <View style={styles.dateRow}>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
            Data de entrega
          </Text>
          <NativeDatePicker
            accessibilityLabel="Data de entrega"
            mode="date"
            onChange={(date) => flow.updateDraft('deliveryDate', todayIso(date))}
            style="compact"
            value={parseIsoCalendarDate(flow.draft.deliveryDate) ?? new Date()}
          />
        </View>
      </View>
      <View style={styles.formSection}>
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
          Entrega
        </Text>
        <OrderTextField
          accessibilityLabel="Endereço de entrega"
          disabled={flow.submitting}
          label="Endereço"
          multiline
          onChangeText={(value) => flow.updateDraft('deliveryAddressSnapshot', value)}
          placeholder="Endereço (opcional para retirada)"
          value={flow.draft.deliveryAddressSnapshot}
        />
        <OrderTextField
          accessibilityLabel="Taxa de entrega cobrada"
          disabled={flow.submitting}
          keyboardType="decimal-pad"
          label="Taxa de entrega cobrada (R$)"
          onChangeText={(value) => flow.updateDraft('deliveryFee', value)}
          placeholder="R$ 0,00"
          value={flow.draft.deliveryFee}
        />
        <OrderTextField
          accessibilityLabel="Custo real da entrega"
          disabled={flow.submitting}
          keyboardType="decimal-pad"
          label="Custo real da entrega (R$)"
          onChangeText={(value) => flow.updateDraft('deliveryCost', value)}
          placeholder="R$ 0,00"
          value={flow.draft.deliveryCost}
        />
      </View>
      <View style={styles.formSection}>
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
          Informações opcionais
        </Text>
        <OrderTextField
          accessibilityLabel="Ocasião"
          disabled={flow.submitting}
          label="Ocasião"
          onChangeText={(value) => flow.updateDraft('occasion', value)}
          placeholder="Ex.: aniversário"
          value={flow.draft.occasion}
        />
        <OrderTextField
          accessibilityLabel="Presenteado"
          disabled={flow.submitting}
          label="Presenteado"
          onChangeText={(value) => flow.updateDraft('recipient', value)}
          placeholder="Nome do presenteado"
          value={flow.draft.recipient}
        />
        <OrderTextField
          accessibilityLabel="Observações"
          disabled={flow.submitting}
          label="Observações"
          multiline
          onChangeText={(value) => flow.updateDraft('notes', value)}
          placeholder="Observações do pedido"
          value={flow.draft.notes}
        />
      </View>
      <View style={styles.formSection}>
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
          Valores
        </Text>
        <OrderTextField
          accessibilityLabel="Desconto"
          disabled={flow.submitting}
          keyboardType="decimal-pad"
          label="Desconto (R$)"
          onChangeText={(value) => flow.updateDraft('discount', value)}
          placeholder="R$ 0,00"
          value={flow.draft.discount}
        />
      </View>
      {flow.preparingOrder ? <Loading label="Validando custos do pedido…" tone="info" /> : null}
      <NativeButton
        controlSize="large"
        disabled={flow.submitting || flow.preparingOrder}
        haptic="light"
        label="Ver resumo"
        onPress={async () => {
          if (!(await flow.validateProducts())) return;
          Keyboard.dismiss();
          router.push('/registrar-pedido-varejo/resumo');
        }}
        variant="primary"
      />
    </>
  );
}

function SummaryStep({ flow }: { flow: RetailOrderFlowContextValue }) {
  const { theme } = useAppTheme();
  const router = useRouter();
  const totals = flow.draftTotals;

  return (
    <>
      <View style={styles.summaryBlock}>
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
          Cliente
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
          {flow.selectedClient?.name ?? 'Não selecionado'}
        </Text>
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
          Produtos
        </Text>
        {totals ? (
          flow.draft.lineItems.map((line) => {
            const product = flow.productById.get(line.productId);
            const lineTotal = totals.lines.find(
              (candidate) => candidate.productId === line.productId,
            );
            if (!product || !lineTotal) return null;
            return (
              <View key={line.productId} style={styles.summaryLine}>
                <View style={styles.summaryLineCopy}>
                  <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                    {product.productName} × {lineTotal.quantity}
                  </Text>
                  <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                    Unitário: {formatCurrency(lineTotal.unitSalePrice)}
                  </Text>
                </View>
                <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                  {formatCurrency(lineTotal.lineSubtotal)}
                </Text>
              </View>
            );
          })
        ) : (
          <Text
            accessibilityRole="alert"
            style={[theme.typography.body, { color: theme.colors.danger }]}
          >
            {flow.draftTotalsError ?? 'Não foi possível calcular o resumo do pedido.'}
          </Text>
        )}
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>Totais</Text>
        {totals ? (
          <>
            <SummaryRow
              label="Subtotal dos produtos"
              value={formatCurrency(totals.subtotalProducts)}
            />
            <SummaryRow label="Desconto" value={formatCurrency(totals.discount)} />
            <SummaryRow label="Taxa de entrega" value={formatCurrency(totals.deliveryFee)} />
            <SummaryRow
              label="Total cobrado"
              value={formatCurrency(totals.totalCharged)}
              emphasized
            />
          </>
        ) : null}
      </View>
      <NativeButton
        controlSize="large"
        disabled={flow.submitting || !totals}
        haptic="light"
        label="Continuar para pagamento"
        onPress={() => {
          flow.clearError();
          router.push('/registrar-pedido-varejo/pagamento');
        }}
        variant="primary"
      />
    </>
  );
}

function SummaryRow({
  emphasized = false,
  label,
  value,
}: {
  emphasized?: boolean;
  label: string;
  value: string;
}) {
  const { theme } = useAppTheme();
  const textStyle = emphasized ? theme.typography.headline : theme.typography.body;
  return (
    <View style={styles.summaryRow}>
      <Text
        style={[
          textStyle,
          { color: emphasized ? theme.colors.textPrimary : theme.colors.textSecondary },
        ]}
      >
        {label}
      </Text>
      <Text style={[textStyle, { color: theme.colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function PaymentStep({ flow }: { flow: RetailOrderFlowContextValue }) {
  const { theme } = useAppTheme();
  const paymentPreview = flow.paymentPreview;

  return (
    <>
      {flow.draftTotals && paymentPreview ? (
        <View style={styles.paymentSummary}>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            Resumo financeiro
          </Text>
          <SummaryRow
            label="Total do pedido"
            value={formatCurrency(flow.draftTotals.totalCharged)}
          />
          <SummaryRow
            label="Valor do pagamento inicial"
            value={formatCurrency(paymentPreview.amount)}
          />
          <SummaryRow
            label="A receber após este pagamento"
            value={formatCurrency(paymentPreview.outstandingAmount)}
          />
        </View>
      ) : null}
      <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
        Pagamento
      </Text>
      <OrderTextField
        accessibilityLabel="Valor do pagamento inicial"
        disabled={flow.submitting}
        keyboardType="decimal-pad"
        label="Valor do pagamento inicial (opcional)"
        onChangeText={(value) => flow.updatePayment('amount', value)}
        placeholder="R$ 0,00"
        value={flow.paymentValues.amount}
      />
      <NativeDropdown
        accessibilityLabel="Forma do pagamento inicial"
        disabled={flow.submitting}
        items={[
          { label: 'Pix', value: 'Pix' },
          { label: 'Dinheiro', value: 'Dinheiro' },
          { label: 'Crédito', value: 'Crédito' },
          { label: 'Débito', value: 'Débito' },
          { label: 'Outro', value: 'Outro' },
        ]}
        label={flow.selectedPaymentLabel}
        onValueChange={(value) =>
          flow.updatePayment(
            'method',
            value as RetailOrderFlowContextValue['paymentValues']['method'],
          )
        }
        selectedValue={flow.paymentValues.method}
      />
      {flow.paymentValues.method === 'Crédito' || flow.paymentValues.method === 'Débito' ? (
        <OrderTextField
          accessibilityLabel="Taxa do cartão"
          disabled={flow.submitting}
          keyboardType="decimal-pad"
          label="Taxa do cartão (opcional)"
          onChangeText={(value) => flow.updatePayment('cardFee', value)}
          placeholder="R$ 0,00"
          value={flow.paymentValues.cardFee}
        />
      ) : null}
      <View style={styles.dateRow}>
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
          Data do pagamento
        </Text>
        <NativeDatePicker
          accessibilityLabel="Data do pagamento inicial"
          mode="date"
          onChange={(date) => flow.updatePayment('paidAt', todayIso(date))}
          style="compact"
          value={parseIsoCalendarDate(flow.paymentValues.paidAt) ?? new Date()}
        />
      </View>
      <OrderTextField
        accessibilityLabel="Observações do pagamento inicial"
        disabled={flow.submitting}
        label="Observações do pagamento (opcional)"
        onChangeText={(value) => flow.updatePayment('notes', value)}
        placeholder="Observação"
        value={flow.paymentValues.notes}
      />
      {!flow.successVisible ? (
        <>
          {flow.submitting ? <Loading label="Salvando pedido…" tone="info" /> : null}
          <NativeButton
            controlSize="large"
            disabled={flow.submitting}
            haptic="light"
            label={flow.pendingOrderId ? 'Tentar registrar pagamento' : 'Confirmar pedido'}
            onPress={() => void flow.submitOrder(true)}
            variant="primary"
          />
        </>
      ) : null}
    </>
  );
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

const styles = StyleSheet.create({
  card: { width: '100%' },
  content: { flexGrow: 1 },
  dateRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  field: { gap: 4, width: '100%' },
  formSection: { gap: 8 },
  lineCard: { gap: 12, padding: 12 },
  lineControls: { alignItems: 'flex-end', flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  lineCopy: { gap: 4, width: '100%' },
  lines: { gap: 8 },
  navigationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentSummary: { gap: 8 },
  screen: { flex: 1 },
  selectedSummary: { gap: 2, paddingVertical: 4 },
  stepHeader: { gap: 4 },
  summaryBlock: { gap: 12 },
  summaryLine: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  summaryLineCopy: { flex: 1, gap: 4 },
  summaryRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  quantityField: { flex: 1, minWidth: 140 },
});
