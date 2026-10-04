import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';

import { Loading } from '@/components/feedback';
import { getNativeLargeTitleStyle, NativeGlassHeader } from '@/components/layout';
import {
  NativeButton,
  NativeDatePicker,
  NativeDialog,
  NativeDropdown,
  NativeTextField,
  type NativeTextFieldProps,
} from '@/components/native';
import {
  PremiumCard,
  PremiumScreen,
  ProgressiveCollapsibleScreen,
  SearchBar,
} from '@/components/premium';
import { StickyActionFooter } from '@/components/premium/StickyActionFooter';
import { useAppSafeAreaInsets } from '@/providers';
import { formatCurrency, normalizeClientKey, parseIsoCalendarDate, todayIso } from '@/utils/data';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import { triggerNativeButtonHaptic } from '@/utils/haptics';

import {
  type RetailOrderFlowContextValue,
  type RetailOrderFlowStep,
  useRetailOrderFlow,
} from './RetailOrderFlowProvider';
import { RetailOrderPrimaryButton } from './RetailOrderPrimaryButton';

const STEP_TITLES: Record<RetailOrderFlowStep, string> = {
  client: 'Cliente',
  products: 'Produtos',
  details: 'Detalhes',
  summary: 'Resumo',
};

export function RetailOrderStepScreen({ step }: { step: RetailOrderFlowStep }) {
  const { resolvedMode, theme } = useAppTheme();
  const insets = useAppSafeAreaInsets();
  const router = useRouter();
  const flow = useRetailOrderFlow();
  const redirectPath = getSafeRedirectPath(flow, step);
  const header = <NativeGlassHeader mode="transparent" pointerEvents="none" title={null} />;
  const pageTitle = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      title={STEP_TITLES[step]}
      titleStyle={getNativeLargeTitleStyle(theme.spacing.xxs)}
    />
  );
  const cardSpacing = theme.spacing.md * 2 - theme.spacing.xs / 2 - 4;
  const contentTopInset = theme.spacing.xxxl + theme.spacing.xl + 2;
  const detailsStickyActionHeight = 58 + insets.bottom + theme.spacing.md + theme.spacing.sm;
  const usesProgressiveCollapsibleScreen = step === 'details' || step === 'summary';

  useEffect(() => {
    if (!flow.catalogLoading && redirectPath) router.replace(redirectPath);
  }, [flow.catalogLoading, redirectPath, router]);

  const cardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const isRedirecting = Boolean(redirectPath);
  const showsDetailsStickyAction =
    step === 'details' && !flow.catalogLoading && !isRedirecting && !flow.catalogError;
  const contentPaddingBottom =
    theme.layout.tabBarHeight +
    insets.bottom +
    theme.spacing.xl +
    (showsDetailsStickyAction ? detailsStickyActionHeight : 0);
  const stepContent =
    flow.catalogLoading || isRedirecting ? (
      <PremiumCard style={[styles.card, { backgroundColor: cardSurface, marginTop: cardSpacing }]}>
        <Loading
          label={isRedirecting ? 'Abrindo pedido Varejo...' : 'Carregando dados do Varejo...'}
        />
      </PremiumCard>
    ) : flow.catalogError ? (
      <PremiumCard style={[styles.card, { backgroundColor: cardSurface, marginTop: cardSpacing }]}>
        <Text style={[theme.typography.body, { color: theme.colors.danger }]}>
          {flow.catalogError}
        </Text>
      </PremiumCard>
    ) : (
      <RetailOrderStepCard cardMarginTop={cardSpacing} flow={flow} step={step} />
    );

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {usesProgressiveCollapsibleScreen ? (
        <ProgressiveCollapsibleScreen
          compactTitle={STEP_TITLES[step]}
          contentGap={0}
          contentTopInset={contentTopInset}
          largeTitle={pageTitle}
          largeTitleContainerStyle={styles.header}
          nativeHeader
          scrollContentContainerStyle={{ paddingBottom: contentPaddingBottom }}
          scrollViewProps={{ keyboardShouldPersistTaps: 'handled' }}
        >
          {stepContent}
        </ProgressiveCollapsibleScreen>
      ) : (
        <PremiumScreen
          contentContainerStyle={[
            styles.content,
            { marginTop: contentTopInset, paddingBottom: contentPaddingBottom },
          ]}
          overlayHeader={header}
          overlayHeaderContentOffset={theme.sizes.touchTargetMinimum}
          progressiveBlur
        >
          <View style={styles.header}>{pageTitle}</View>
          {stepContent}
        </PremiumScreen>
      )}
      {showsDetailsStickyAction ? (
        <DetailsStickyAction flow={flow} height={detailsStickyActionHeight} />
      ) : null}
      {step === 'summary' ? (
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
): '/registrar-pedido-varejo' | null {
  if (step !== 'client' && !flow.draft.clientId) return '/registrar-pedido-varejo';
  if ((step === 'details' || step === 'summary') && !flow.draft.lineItems.length) {
    return '/registrar-pedido-varejo';
  }
  return null;
}

function handleSuccess(flow: RetailOrderFlowContextValue, router: ReturnType<typeof useRouter>) {
  if (!flow.successVisible) return;
  flow.dismissSuccess();
  router.dismissTo('/registrar');
}

export function RetailOrderCombinedRegistrarScreen() {
  const { resolvedMode, theme } = useAppTheme();
  const insets = useAppSafeAreaInsets();
  const router = useRouter();
  const flow = useRetailOrderFlow();
  const stickyActionFooterHeight = 58 + insets.bottom + theme.spacing.md + theme.spacing.sm;
  const contentTopInset = theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2;
  const largeTitle = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      title="Novo pedido"
      titleStyle={getNativeLargeTitleStyle(theme.spacing.xxs)}
    />
  );
  const continueDisabled =
    flow.catalogLoading ||
    Boolean(flow.catalogError) ||
    !flow.selectedClient ||
    !flow.canContinueProducts;

  const handleContinue = async () => {
    if (!flow.selectedClient || continueDisabled) return;
    if (!(await flow.validateProducts())) return;

    triggerNativeButtonHaptic('light');
    Keyboard.dismiss();
    router.push('/registrar-pedido-varejo/detalhes');
  };

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityHint="Abre o cadastro de cliente Varejo"
          accessibilityLabel="Adicionar cliente"
          onPress={() => {
            Keyboard.dismiss();
            router.push('/registrar-pedido-varejo/novo-cliente');
          }}
          separateBackground={false}
          tintColor={theme.colors.textPrimary}
        >
          <Stack.Toolbar.Icon sf="person.badge.plus" />
          <Stack.Toolbar.Label>Novo cliente</Stack.Toolbar.Label>
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
        <ProgressiveCollapsibleScreen
          compactTitle="Novo pedido"
          contentGap={0}
          contentTopInset={contentTopInset}
          largeTitle={largeTitle}
          largeTitleContainerStyle={{
            marginBottom: theme.spacing.xs,
            paddingHorizontal: theme.layout.screenHorizontalPadding,
          }}
          nativeHeader
          scrollViewProps={{ keyboardShouldPersistTaps: 'handled' }}
          scrollContentContainerStyle={{
            paddingBottom: insets.bottom + theme.spacing.xl + stickyActionFooterHeight,
            paddingHorizontal: 0,
          }}
        >
          <View
            style={[
              styles.combinedContent,
              {
                gap: theme.spacing.md,
                paddingHorizontal: theme.layout.screenHorizontalPadding,
                paddingTop: theme.spacing.md,
              },
            ]}
          >
            {flow.error ? (
              <Text
                accessibilityRole="alert"
                style={[theme.typography.footnote, { color: theme.colors.danger }]}
              >
                {flow.error}
              </Text>
            ) : null}
            {flow.catalogLoading ? (
              <PremiumCard
                style={[
                  styles.card,
                  {
                    backgroundColor: getCardSurfaceColor(resolvedMode, theme.colors.surface),
                    borderRadius: theme.radius.xl + theme.spacing.sm,
                  },
                ]}
              >
                <Loading label="Carregando dados do Varejo..." />
              </PremiumCard>
            ) : flow.catalogError ? (
              <PremiumCard
                style={[
                  styles.card,
                  {
                    backgroundColor: getCardSurfaceColor(resolvedMode, theme.colors.surface),
                    borderRadius: theme.radius.xl + theme.spacing.sm,
                  },
                ]}
              >
                <Text style={[theme.typography.body, { color: theme.colors.danger }]}>
                  {flow.catalogError}
                </Text>
              </PremiumCard>
            ) : (
              <>
                <RetailOrderEntryCard title="Cliente">
                  <RetailOrderClientSearch flow={flow} />
                </RetailOrderEntryCard>
                <RetailOrderEntryCard title="Produtos">
                  <ProductsStep flow={flow} showContinue={false} />
                </RetailOrderEntryCard>
              </>
            )}
          </View>
        </ProgressiveCollapsibleScreen>
        <StickyActionFooter height={stickyActionFooterHeight}>
          <RetailOrderPrimaryButton
            accessibilityHint={
              !flow.selectedClient
                ? 'Selecione um cliente para continuar.'
                : flow.canContinueProducts
                  ? undefined
                  : 'Adicione ao menos um produto válido para continuar.'
            }
            accessibilityValue={continueDisabled ? 'Indisponível' : undefined}
            disabled={continueDisabled}
            gateDisabledAction
            haptic="none"
            label="Continuar"
            onPress={() => void handleContinue()}
          />
        </StickyActionFooter>
      </View>
    </>
  );
}

function RetailOrderClientSearch({ flow }: { flow: RetailOrderFlowContextValue }) {
  const { theme } = useAppTheme();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const normalizedQuery = normalizeClientKey(query);
  const matchingClients = useMemo(
    () =>
      normalizedQuery
        ? flow.activeClients.filter((client) =>
            normalizeClientKey(client.name).includes(normalizedQuery),
          )
        : [],
    [flow.activeClients, normalizedQuery],
  );
  const displayedValue = searching ? query : (flow.selectedClient?.name ?? '');

  return (
    <View style={[styles.clientSearch, { gap: theme.spacing.sm }]}>
      <SearchBar
        accessibilityLabel="Buscar cliente"
        onChangeText={(value) => {
          setQuery(value);
          setSearching(true);
        }}
        onClear={() => {
          setQuery('');
          setSearching(false);
          flow.handleClientChange('');
        }}
        onFocus={() => {
          if (!searching) setQuery('');
          setSearching(true);
        }}
        placeholder="Buscar cliente"
        value={displayedValue}
      />
      {searching && normalizedQuery ? (
        matchingClients.length ? (
          <View style={[styles.clientSearchResults, { gap: theme.spacing.xs }]}>
            {matchingClients.map((client) => (
              <Pressable
                accessibilityLabel={client.name}
                accessibilityRole="button"
                key={client.clientId}
                onPress={() => {
                  flow.handleClientChange(client.clientId);
                  setQuery('');
                  setSearching(false);
                  Keyboard.dismiss();
                }}
                style={[
                  styles.clientSearchResult,
                  {
                    minHeight: theme.sizes.touchTargetMinimum,
                    paddingHorizontal: theme.spacing.xs,
                  },
                ]}
                testID={`retail-client-result-${client.clientId}`}
              >
                <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                  {client.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Nenhum cliente encontrado
          </Text>
        )
      ) : null}
    </View>
  );
}

function RetailOrderEntryCard({ children, title }: { children: ReactNode; title: string }) {
  const { resolvedMode, theme } = useAppTheme();

  return (
    <PremiumCard
      style={[
        styles.card,
        {
          backgroundColor: getCardSurfaceColor(resolvedMode, theme.colors.surface),
          borderRadius: theme.radius.xl + theme.spacing.sm,
          gap: theme.spacing.md,
        },
      ]}
    >
      <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{title}</Text>
      {children}
    </PremiumCard>
  );
}

function RetailOrderStepCard({
  cardMarginTop,
  flow,
  step,
}: {
  cardMarginTop: number;
  flow: RetailOrderFlowContextValue;
  step: RetailOrderFlowStep;
}) {
  const { resolvedMode, theme } = useAppTheme();
  const error = flow.error ? (
    <Text
      accessibilityRole="alert"
      style={[theme.typography.footnote, { color: theme.colors.danger }]}
    >
      {flow.error}
    </Text>
  ) : null;

  if (step === 'details') {
    return (
      <View style={[styles.detailsContainer, { gap: theme.spacing.md, marginTop: cardMarginTop }]}>
        {error}
        <DetailsStep flow={flow} />
      </View>
    );
  }

  return (
    <PremiumCard
      style={[
        styles.card,
        {
          backgroundColor: getCardSurfaceColor(resolvedMode, theme.colors.surface),
          borderRadius: theme.radius.xl + theme.spacing.md,
          gap: theme.spacing.md,
          marginTop: cardMarginTop,
          padding: theme.spacing.lg,
          paddingTop: theme.spacing.md,
        },
      ]}
    >
      {error}
      {step === 'client' ? <ClientStep flow={flow} /> : null}
      {step === 'products' ? <ProductsStep flow={flow} /> : null}
      {step === 'summary' ? <SummaryStep flow={flow} /> : null}
    </PremiumCard>
  );
}

function ClientStep({
  flow,
  showContinue = true,
  showSelectorLabel = true,
}: {
  flow: RetailOrderFlowContextValue;
  showContinue?: boolean;
  showSelectorLabel?: boolean;
}) {
  const router = useRouter();
  const { resolvedMode, theme } = useAppTheme();
  const hasClients = flow.activeClients.length > 0;
  const continueDisabled = flow.submitting || !flow.selectedClient;
  const continueAccessibilityHint = flow.submitting
    ? 'Aguarde enquanto o pedido é processado.'
    : !flow.selectedClient
      ? 'Selecione um cliente para continuar.'
      : undefined;

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

  const selector = (
    <NativeDropdown
      accessibilityLabel="Selecione o cliente"
      disabled={flow.submitting}
      items={flow.activeClients.map((client) => ({
        label: client.name,
        value: client.clientId,
      }))}
      label={flow.selectedClient?.name ?? 'Selecionar'}
      onValueChange={flow.handleClientChange}
      selectedValue={flow.draft.clientId}
    />
  );

  return (
    <>
      {showSelectorLabel ? (
        <View style={styles.clientSelectorRow}>
          <Text
            style={[
              styles.clientSelectorLabel,
              theme.typography.body,
              { color: theme.colors.textPrimary, fontWeight: '600' },
            ]}
          >
            Selecione o cliente
          </Text>
          {selector}
        </View>
      ) : (
        <View style={styles.clientDropdown}>{selector}</View>
      )}
      {showContinue ? (
        <RetailOrderPrimaryButton
          accessibilityHint={continueAccessibilityHint}
          accessibilityValue={continueDisabled ? 'Indisponível' : undefined}
          disabled={continueDisabled}
          gateDisabledAction
          label="Continuar"
          onPress={() => {
            if (!flow.selectedClient) return;
            flow.clearError();
            Keyboard.dismiss();
            router.push('/registrar-pedido-varejo/produtos');
          }}
        />
      ) : null}
    </>
  );
}

function ProductsStep({
  flow,
  showContinue = true,
}: {
  flow: RetailOrderFlowContextValue;
  showContinue?: boolean;
}) {
  const { resolvedMode, theme } = useAppTheme();
  const router = useRouter();

  return (
    <>
      {!flow.activeProducts.length ? (
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          Cadastre um produto Varejo antes de criar um pedido.
        </Text>
      ) : (
        <View style={styles.clientSelectorRow}>
          <Text
            style={[
              styles.clientSelectorLabel,
              theme.typography.body,
              { color: theme.colors.textPrimary, fontWeight: '600' },
            ]}
          >
            Selecionar produto
          </Text>
          <NativeDropdown
            accessibilityLabel="Selecionar produto"
            disabled={flow.submitting || Boolean(flow.validatingProductId)}
            items={flow.productOptions}
            label={flow.selectedProductLabel}
            onValueChange={flow.handleAddProduct}
            selectedValue={flow.selectedProductId}
          />
        </View>
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
                    backgroundColor:
                      resolvedMode === 'light'
                        ? theme.colors.background
                        : theme.colors.surfaceMuted,
                    borderRadius: theme.radius.card,
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
      {showContinue ? (
        <RetailOrderPrimaryButton
          accessibilityHint={
            flow.canContinueProducts
              ? undefined
              : 'Adicione ao menos um produto válido para continuar.'
          }
          accessibilityValue={flow.canContinueProducts ? undefined : 'Indisponível'}
          disabled={!flow.canContinueProducts}
          gateDisabledAction
          label="Continuar"
          onPress={async () => {
            if (!(await flow.validateProducts())) return;
            Keyboard.dismiss();
            router.push('/registrar-pedido-varejo/detalhes');
          }}
        />
      ) : null}
    </>
  );
}

function DetailsStep({ flow }: { flow: RetailOrderFlowContextValue }) {
  const { resolvedMode, theme } = useAppTheme();
  const cardStyle = [
    styles.detailsCard,
    {
      backgroundColor: getCardSurfaceColor(resolvedMode, theme.colors.surface),
      borderRadius: theme.radius.xl + theme.spacing.md,
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      paddingTop: theme.spacing.md,
    },
  ];

  return (
    <>
      <PremiumCard style={cardStyle}>
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
      </PremiumCard>
      <PremiumCard style={cardStyle}>
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
      </PremiumCard>
      <PremiumCard style={cardStyle}>
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
      </PremiumCard>
      <PremiumCard style={cardStyle}>
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
      </PremiumCard>
      {flow.preparingOrder ? <Loading label="Validando custos do pedido…" tone="info" /> : null}
    </>
  );
}

function DetailsStickyAction({
  flow,
  height,
}: {
  flow: RetailOrderFlowContextValue;
  height: number;
}) {
  const router = useRouter();

  return (
    <StickyActionFooter height={height}>
      <RetailOrderPrimaryButton
        accessibilityHint={
          flow.preparingOrder ? 'Aguarde enquanto os custos do pedido são validados.' : undefined
        }
        accessibilityValue={flow.preparingOrder ? 'Indisponível' : undefined}
        disabled={flow.submitting || flow.preparingOrder}
        gateDisabledAction
        label="Ver resumo"
        onPress={async () => {
          if (!(await flow.validateProducts())) return;
          Keyboard.dismiss();
          router.push('/registrar-pedido-varejo/resumo');
        }}
      />
    </StickyActionFooter>
  );
}

function SummaryStep({ flow }: { flow: RetailOrderFlowContextValue }) {
  const { theme } = useAppTheme();
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
      <RetailOrderPrimaryButton
        disabled={flow.submitting || !totals}
        label="Finalizar pedido"
        onPress={() => void flow.submitOrder()}
      />
      {flow.submitting ? <Loading label="Salvando pedido…" tone="info" /> : null}
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
  clientSelectorLabel: { flex: 1 },
  clientDropdown: { alignItems: 'flex-start', width: '100%' },
  clientSearch: { width: '100%' },
  clientSearchResult: { justifyContent: 'center' },
  clientSearchResults: { width: '100%' },
  clientSelectorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  content: { flexGrow: 1 },
  combinedContent: { width: '100%' },
  detailsCard: { width: '100%' },
  detailsContainer: { width: '100%' },
  dateRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  header: { minHeight: 44 },
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
  screen: { flex: 1 },
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
