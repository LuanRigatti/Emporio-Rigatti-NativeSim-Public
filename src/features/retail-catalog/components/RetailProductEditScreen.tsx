import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove, type NavigationAction } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { InlineError } from '@/components/feedback';
import { NativeGlassHeader } from '@/components/layout';
import {
  NativeButton,
  NativeDropdown,
  type NativeRetailProductCostItemOption,
} from '@/components/native';
import { ConfirmationDialog } from '@/components/overlays';
import {
  EmptyState,
  ErrorState,
  Loading,
  PremiumCard,
  PremiumScreen,
  PremiumSection,
} from '@/components/premium';
import { ProgressiveBlur } from '@/components/ui/progressive-blur';
import { ENABLE_PROGRESSIVE_BLUR } from '@/config/featureFlags';
import { useRetailCategories } from '@/hooks/useRetailCategories';
import { useRetailCostItems } from '@/hooks/useRetailCostItems';
import { useRetailProductCurrentCost } from '@/hooks/useRetailProductCurrentCost';
import { useRetailProducts } from '@/hooks/useRetailProducts';
import { useAppMode, useAppSafeAreaInsets } from '@/providers';
import { useAppTheme } from '@/theme';
import type { RetailProduct, RetailProductCostMode } from '@/types/data';
import { formatCurrency, formatPtBrDate, normalizeMoney } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import { RetailCatalogLabeledTextField } from './RetailCatalogLabeledTextField';

type RetailProductEditScreenProps = {
  initialCategoryId?: string;
  mode?: 'create' | 'edit';
  productId?: string;
};

type ProductCategoryOption = {
  categoryId: string;
  label: string;
};

type ProductFormValues = {
  categoryId: string;
  productName: string;
  variant: string;
  flavor: string;
  packageSize: string;
  standardSalePrice: string;
  skuCode: string;
  costMode: RetailProductCostMode | '';
  directCostItemId: string;
};

type ProductDraft = ProductFormValues & {
  compositionVersionId?: string;
  productId?: string;
};

function createEmptyDraft(initialCategoryId?: string): ProductDraft {
  return {
    categoryId: initialCategoryId ?? '',
    costMode: '',
    directCostItemId: '',
    flavor: '',
    packageSize: '',
    productName: '',
    skuCode: '',
    standardSalePrice: '',
    variant: '',
  };
}

function createDraft(product: RetailProduct): ProductDraft {
  return {
    categoryId: product.categoryId,
    compositionVersionId: product.compositionVersionId,
    costMode: product.costMode ?? '',
    directCostItemId: product.directCostItemId ?? '',
    flavor: product.flavor ?? '',
    packageSize: product.packageSize ?? '',
    productId: product.productId,
    productName: product.productName,
    skuCode: product.skuCode ?? '',
    standardSalePrice: String(product.standardSalePrice),
    variant: product.variant ?? '',
  };
}

function costKey(product: RetailProduct): string {
  return `${product.costMode ?? ''}|${product.directCostItemId ?? ''}|${product.compositionVersionId ?? ''}`;
}

function categoryOptions(
  categories: readonly { categoryId: string; label: string; active: boolean }[],
): readonly ProductCategoryOption[] {
  return categories
    .filter((category) => category.active)
    .map(({ categoryId, label }) => ({ categoryId, label }));
}

function costItemOptions(
  items: readonly { active: boolean; costItemId: string; name: string; unit: string }[],
  selectedId?: string,
): readonly NativeRetailProductCostItemOption[] {
  return items
    .filter((item) => item.active || item.costItemId === selectedId)
    .map((item) => ({
      costItemId: item.costItemId,
      label: item.active ? item.name : `${item.name} (desativado)`,
      unit: item.unit,
    }));
}

export function RetailProductEditScreen({
  initialCategoryId,
  mode: screenMode = 'edit',
  productId,
}: RetailProductEditScreenProps) {
  const isCreate = screenMode === 'create';
  const { theme } = useAppTheme();
  const insets = useAppSafeAreaInsets();
  const cardRadius = theme.radius.xl + theme.spacing.md;
  const saveStickyActionHeight = 58 + insets.bottom + theme.spacing.md + theme.spacing.sm;
  const { mode } = useAppMode();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const router = useRouter();
  const navigation = useNavigation();
  const {
    create,
    error: productsError,
    loading: productsLoading,
    products,
    update,
  } = useRetailProducts();
  const {
    categories,
    error: categoriesError,
    loading: categoriesLoading,
  } = useRetailCategories({ includeInactive: true });
  const {
    items: costItems,
    error: costItemsError,
    loading: costItemsLoading,
  } = useRetailCostItems({
    includeInactive: true,
  });
  const product = useMemo(
    () => products.find((candidate) => candidate.productId === productId),
    [productId, products],
  );
  const currentCost = useRetailProductCurrentCost(product, costItems, { costItemsLoading });
  const [draft, setDraft] = useState<ProductDraft | null>(() =>
    isCreate ? createEmptyDraft(initialCategoryId) : null,
  );
  const [initialDraft, setInitialDraft] = useState<ProductDraft | null>(() =>
    isCreate ? createEmptyDraft(initialCategoryId) : null,
  );
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [shouldLeaveAfterSave, setShouldLeaveAfterSave] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [allowNextRemove, setAllowNextRemove] = useState(false);
  const pendingRemoveActionRef = useRef<NavigationAction | null>(null);
  const persistedCostKeyRef = useRef<string | undefined>(undefined);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isCreate) return;
    if (!product) return;
    if (draft?.productId !== product.productId) {
      const nextDraft = createDraft(product);
      setDraft(nextDraft);
      setInitialDraft(nextDraft);
      persistedCostKeyRef.current = costKey(product);
    }
  }, [draft?.productId, isCreate, product]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (isCreate) return;
    if (!product || !draft || draft.productId !== product.productId) return;
    const nextCostKey = costKey(product);
    if (persistedCostKeyRef.current === undefined) {
      persistedCostKeyRef.current = nextCostKey;
      return;
    }
    if (persistedCostKeyRef.current === nextCostKey) return;
    persistedCostKeyRef.current = nextCostKey;
    const nextCostFields = {
      compositionVersionId: product.compositionVersionId,
      costMode: product.costMode ?? '',
      directCostItemId: product.directCostItemId ?? '',
    } as const;
    setDraft((current) => (current ? { ...current, ...nextCostFields } : current));
    setInitialDraft((current) => (current ? { ...current, ...nextCostFields } : current));
  }, [draft, isCreate, product]);

  useEffect(() => {
    if (!shouldLeaveAfterSave || isSaving) return;
    router.back();
  }, [isSaving, router, shouldLeaveAfterSave]);

  const updateDraft = useCallback(
    <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => {
      setDraft((current) => (current ? { ...current, [key]: value } : current));
      setError(undefined);
    },
    [],
  );

  const hasPendingChanges = Boolean(
    !testModeEnabled &&
    draft &&
    initialDraft &&
    JSON.stringify(draft) !== JSON.stringify(initialDraft),
  );

  const handleBeforeRemove = useCallback(
    ({ data: { action } }: { data: { action: NavigationAction } }) => {
      if (!hasPendingChanges || isSaving) return;
      pendingRemoveActionRef.current = action;
      setShowDiscardDialog(true);
    },
    [hasPendingChanges, isSaving],
  );

  usePreventRemove(Boolean(hasPendingChanges && !allowNextRemove && !isSaving), handleBeforeRemove);

  useEffect(() => {
    if (!allowNextRemove) return;
    const action = pendingRemoveActionRef.current;
    pendingRemoveActionRef.current = null;
    if (action) navigation.dispatch(action);
  }, [allowNextRemove, navigation]);

  const confirmDiscard = useCallback(() => {
    setShowDiscardDialog(false);
    setAllowNextRemove(true);
  }, []);

  const categoriesForForm = useMemo(() => categoryOptions(categories), [categories]);
  const selectedCategoryLabel = categories.find(
    (category) => category.categoryId === draft?.categoryId,
  )?.label;
  const directCostItems = useMemo(
    () => costItemOptions(costItems, draft?.directCostItemId),
    [costItems, draft?.directCostItemId],
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isCreate || !draft || draft.categoryId || !categoriesForForm[0]) return;
    const defaultCategoryId = categoriesForForm[0].categoryId;
    setDraft((current) => {
      if (!current || current.categoryId) return current;
      return { ...current, categoryId: defaultCategoryId };
    });
    setInitialDraft((current) => {
      if (!current || current.categoryId) return current;
      return { ...current, categoryId: defaultCategoryId };
    });
  }, [categoriesForForm, draft, isCreate]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const openComposition = useCallback(() => {
    if (isCreate || !productId || !draft || !costItems.length) return;
    router.push({
      pathname: '/catalogo-varejo/produto/[productId]/composicao',
      params: { productId },
    });
  }, [costItems.length, draft, isCreate, productId, router]);

  const save = useCallback(async () => {
    if (!draft || isSaving || testModeEnabled || (!isCreate && !product)) return;
    if (!draft.categoryId) {
      setError('Selecione uma categoria.');
      return;
    }
    if (!draft.productName.trim()) {
      setError('Informe o nome do produto.');
      return;
    }
    const price = normalizeMoney(draft.standardSalePrice);
    if (!draft.standardSalePrice.trim() || price === undefined || price < 0) {
      setError('Informe um preço de venda válido.');
      return;
    }
    if (draft.costMode === 'direct' && !draft.directCostItemId) {
      setError('Selecione o item de custo direto.');
      return;
    }
    setError(undefined);
    setIsSaving(true);
    Keyboard.dismiss();
    try {
      const categoryName = categories.find(
        (category) => category.categoryId === draft.categoryId,
      )?.label;
      if (isCreate) {
        await create({
          categoryId: draft.categoryId,
          categoryName,
          flavor: draft.flavor,
          packageSize: draft.packageSize,
          productName: draft.productName,
          skuCode: draft.skuCode,
          standardSalePrice: price,
          variant: draft.variant,
          ...(draft.costMode === 'direct'
            ? { costMode: 'direct' as const, directCostItemId: draft.directCostItemId }
            : {}),
          ...(draft.costMode === 'composition' ? { costMode: 'composition' as const } : {}),
        });
      } else if (product) {
        await update(product.productId, {
          categoryId: draft.categoryId,
          categoryName,
          compositionVersionId:
            draft.costMode === 'composition' ? (draft.compositionVersionId ?? null) : null,
          costMode: draft.costMode || null,
          directCostItemId: draft.costMode === 'direct' ? draft.directCostItemId || null : null,
          flavor: draft.flavor,
          packageSize: draft.packageSize,
          productName: draft.productName,
          skuCode: draft.skuCode,
          standardSalePrice: price,
          variant: draft.variant,
        });
      }
      setInitialDraft(draft);
      setShouldLeaveAfterSave(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Não foi possível salvar o produto.',
      );
    } finally {
      setIsSaving(false);
    }
  }, [categories, create, draft, isCreate, isSaving, product, testModeEnabled, update]);

  if (mode !== 'retail') {
    return (
      <EmptyState
        description="Alterne para Varejo para acessar o catálogo."
        title="Catálogo Varejo"
      />
    );
  }
  if (categoriesLoading || (!isCreate && (costItemsLoading || productsLoading))) {
    return <Loading label="Carregando produto" />;
  }
  if (categoriesError || (!isCreate && (costItemsError || productsError))) {
    return (
      <ErrorState
        description={categoriesError ?? costItemsError ?? productsError}
        title="Não foi possível carregar"
      />
    );
  }
  if ((!isCreate && !product) || !draft) {
    return <EmptyState title="Produto não encontrado" />;
  }

  const disabled = testModeEnabled || isSaving;
  const currentCostMatchesDraft = !hasPendingChanges && currentCost.mode === draft.costMode;

  return (
    <>
      <PremiumScreen
        contentContainerStyle={[
          styles.content,
          !isCreate
            ? {
                paddingBottom:
                  theme.layout.tabBarHeight +
                  insets.bottom +
                  theme.spacing.xl +
                  saveStickyActionHeight,
              }
            : undefined,
          { backgroundColor: theme.colors.background },
        ]}
        overlayHeader={
          <NativeGlassHeader
            mode="transparent"
            title={isCreate ? 'Novo produto' : 'Editar produto'}
          />
        }
        progressiveBlur
      >
        <View style={{ height: theme.sizes.touchTargetMinimum }} />
        <PremiumSection title="Produto">
          <PremiumCard style={[styles.card, { borderRadius: cardRadius }]}>
            <NativeDropdown
              accessibilityLabel="Categoria"
              disabled={disabled || !categoriesForForm.length}
              items={categoriesForForm.map((category) => ({
                label: category.label,
                value: category.categoryId,
              }))}
              label={selectedCategoryLabel ?? 'Categoria'}
              onValueChange={(value) => updateDraft('categoryId', value)}
              selectedValue={draft.categoryId}
            />
            <RetailCatalogLabeledTextField
              accessibilityLabel="Nome do produto"
              disabled={disabled}
              label="Nome do produto"
              onChangeText={(value) => updateDraft('productName', value)}
              placeholder="Ex.: Cesta Café Portugal"
              value={draft.productName}
            />
            <RetailCatalogLabeledTextField
              accessibilityLabel="Variante ou modelo"
              disabled={disabled}
              label="Variante/modelo"
              onChangeText={(value) => updateDraft('variant', value)}
              placeholder="Ex.: Tradicional"
              value={draft.variant}
            />
            <RetailCatalogLabeledTextField
              accessibilityLabel="Sabor"
              disabled={disabled}
              label="Sabor"
              onChangeText={(value) => updateDraft('flavor', value)}
              placeholder="Ex.: Frango"
              value={draft.flavor}
            />
            <RetailCatalogLabeledTextField
              accessibilityLabel="Tamanho da embalagem"
              disabled={disabled}
              label="Tamanho/embalagem"
              onChangeText={(value) => updateDraft('packageSize', value)}
              placeholder="Ex.: 10 unidades"
              value={draft.packageSize}
            />
            <RetailCatalogLabeledTextField
              accessibilityLabel="SKU"
              disabled={disabled}
              label="SKU"
              onChangeText={(value) => updateDraft('skuCode', value)}
              placeholder="Código comercial"
              value={draft.skuCode}
            />
          </PremiumCard>
        </PremiumSection>
        <PremiumSection title="Venda">
          <PremiumCard style={[styles.card, { borderRadius: cardRadius }]}>
            <RetailCatalogLabeledTextField
              accessibilityLabel="Preço de venda"
              disabled={disabled}
              keyboardType="decimal-pad"
              label="Preço de venda"
              onChangeText={(value) => updateDraft('standardSalePrice', value)}
              placeholder="R$ 0,00"
              value={draft.standardSalePrice}
            />
          </PremiumCard>
        </PremiumSection>
        <PremiumSection title="Custo">
          <PremiumCard style={[styles.card, { borderRadius: cardRadius }]}>
            <NativeDropdown
              accessibilityLabel="Modo de custo"
              disabled={disabled}
              items={[
                { label: 'Sem custo configurado', value: '' },
                { label: 'Direto', value: 'direct' },
                { label: 'Composição', value: 'composition' },
              ]}
              label="Modo de custo"
              onValueChange={(value) => {
                const costMode = value as RetailProductCostMode | '';
                updateDraft('costMode', costMode);
                if (costMode !== 'direct') updateDraft('directCostItemId', '');
              }}
              selectedValue={draft.costMode}
            />
            {draft.costMode === 'direct' ? (
              <NativeDropdown
                accessibilityLabel="Item de custo direto"
                disabled={disabled || !directCostItems.length}
                items={directCostItems.map((item) => ({
                  label: `${item.label} (${item.unit})`,
                  value: item.costItemId,
                }))}
                label="Item de custo"
                onValueChange={(value) => updateDraft('directCostItemId', value)}
                selectedValue={draft.directCostItemId}
              />
            ) : null}
            {draft.costMode === 'composition' ? (
              <>
                <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                  Composição usa os componentes e seus custos históricos.
                </Text>
                {!isCreate && costItems.length ? (
                  <NativeButton
                    disabled={disabled}
                    haptic="light"
                    label="Editar composição"
                    onPress={openComposition}
                    variant="surface"
                  />
                ) : isCreate && costItems.length ? (
                  <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                    Salve o produto para criar a composição.
                  </Text>
                ) : (
                  <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                    Cadastre itens de custo em Custos antes de criar a composição.
                  </Text>
                )}
              </>
            ) : null}
            <CurrentCostSummary
              currentCost={currentCost}
              isCurrent={currentCostMatchesDraft}
              theme={theme}
            />
          </PremiumCard>
        </PremiumSection>
        {error ? <InlineError message={error} /> : null}
        {isCreate ? (
          <NativeButton
            controlSize="large"
            disabled={disabled}
            haptic="light"
            label="Adicionar"
            onPress={() => void save()}
            variant="primary"
          />
        ) : null}
      </PremiumScreen>
      {!isCreate ? (
        <ProductSaveStickyAction
          disabled={disabled}
          height={saveStickyActionHeight}
          onPress={() => void save()}
        />
      ) : null}
      <ConfirmationDialog
        cancelLabel="Continuar editando"
        confirmLabel="Descartar"
        message="As alterações não salvas serão perdidas."
        onCancel={() => {
          pendingRemoveActionRef.current = null;
          setShowDiscardDialog(false);
        }}
        onConfirm={confirmDiscard}
        title="Descartar alterações?"
        visible={showDiscardDialog}
      />
    </>
  );
}

function ProductSaveStickyAction({
  disabled,
  height,
  onPress,
}: {
  disabled: boolean;
  height: number;
  onPress: () => void;
}) {
  const { width } = useWindowDimensions();
  const { resolvedMode, theme } = useAppTheme();
  const insets = useAppSafeAreaInsets();
  const showProgressiveBlur = ENABLE_PROGRESSIVE_BLUR && Platform.OS === 'ios';

  return (
    <View pointerEvents="box-none" style={[styles.saveStickyAction, { height }]}>
      {showProgressiveBlur ? (
        <ProgressiveBlur
          edge="bottom"
          fadeStart={theme.spacing.sm}
          height={height}
          intensity={30}
          layers={4}
          style={{ bottom: 0 }}
          tint={resolvedMode === 'dark' ? 'systemChromeMaterialDark' : 'systemUltraThinMaterial'}
        />
      ) : null}
      <View
        pointerEvents="box-none"
        style={[
          styles.saveStickyActionContent,
          { paddingBottom: insets.bottom + theme.spacing.sm },
        ]}
      >
        <NativeButton
          backgroundColor={theme.colors.contrastSurface}
          color={theme.colors.contrastContent}
          controlSize="large"
          disabled={disabled}
          haptic="light"
          horizontalPadding={28}
          label="Salvar"
          minHeight={58}
          minWidth={width * 0.84}
          onPress={onPress}
          variant="filled"
        />
      </View>
    </View>
  );
}

function CurrentCostSummary({
  currentCost,
  isCurrent,
  theme,
}: {
  currentCost: ReturnType<typeof useRetailProductCurrentCost>;
  isCurrent: boolean;
  theme: ReturnType<typeof useAppTheme>['theme'];
}) {
  const status = isCurrent ? currentCost.status : 'unavailable';
  const message = isCurrent
    ? currentCost.message
    : 'Salve as alterações para recalcular o custo atual.';
  return (
    <View style={styles.costSummary}>
      <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
        Custo atual
      </Text>
      {status === 'loading' ? (
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          Calculando…
        </Text>
      ) : status === 'available' && currentCost.cost !== undefined ? (
        <>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
            {formatCurrency(currentCost.cost)}
          </Text>
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Referência: {formatPtBrDate(currentCost.referenceDate)}
          </Text>
        </>
      ) : (
        <>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            Custo indisponível
          </Text>
          {message ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              {message}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14, width: '100%' },
  content: { flexGrow: 1, gap: 18 },
  costSummary: { gap: 4 },
  saveStickyAction: { bottom: 0, left: 0, position: 'absolute', right: 0, zIndex: 3 },
  saveStickyActionContent: {
    alignItems: 'center',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
