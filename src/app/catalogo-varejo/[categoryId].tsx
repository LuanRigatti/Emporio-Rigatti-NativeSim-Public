import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TextButton } from '@/components/buttons';
import { ListItem } from '@/components/lists';
import {
  NativeCardContextMenu,
  NativeRetailCompositionSheet,
  NativeRetailProductCostSheet,
  NativeRetailProductFormSheet,
  type NativeRetailCompositionCostItemOption,
  type NativeRetailCompositionFormValues,
  type NativeRetailProductCostFormValues,
  type NativeRetailProductCostItemOption,
  type NativeRetailProductCategoryOption,
  type NativeRetailProductFormValues,
} from '@/components/native';
import { NativeGlassHeader } from '@/components/layout';
import { ConfirmationDialog } from '@/components/overlays';
import { EmptyState, ErrorState, Loading, PremiumCard, PremiumScreen } from '@/components/premium';
import { useRetailCategories } from '@/hooks/useRetailCategories';
import { useRetailCompositions } from '@/hooks/useRetailCompositions';
import { useRetailCostItems } from '@/hooks/useRetailCostItems';
import { useRetailProducts } from '@/hooks/useRetailProducts';
import { useAppMode } from '@/providers';
import { normalizeRetailQuantity } from '@/services/retail-costs';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import type { RetailCostItem, RetailProduct } from '@/types/data';
import { formatCurrency, normalizeMoney, todayIso } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import SettingsIcon from '@/features/settings/components/SettingsIcon';

function toProductDraft(
  values: NativeRetailProductFormValues,
  categories: readonly NativeRetailProductCategoryOption[],
) {
  const category = categories.find((candidate) => candidate.categoryId === values.categoryId);
  const price = normalizeMoney(values.standardSalePrice);
  if (!category) throw new Error('Selecione uma categoria.');
  if (price === undefined || price < 0) throw new Error('O preço de venda deve ser zero ou maior.');
  return {
    categoryId: category.categoryId,
    categoryName: category.label,
    flavor: values.flavor,
    packageSize: values.packageSize,
    productName: values.productName,
    skuCode: values.skuCode,
    standardSalePrice: price,
    variant: values.variant,
  };
}

function productFormValues(product?: RetailProduct | null): Partial<NativeRetailProductFormValues> {
  return product
    ? {
        categoryId: product.categoryId,
        costMode: product.costMode ?? '',
        directCostItemId: product.directCostItemId ?? '',
        flavor: product.flavor ?? '',
        packageSize: product.packageSize ?? '',
        productName: product.productName,
        skuCode: product.skuCode ?? '',
        standardSalePrice: String(product.standardSalePrice),
        variant: product.variant ?? '',
      }
    : {};
}

function productCostDraft(values: NativeRetailProductFormValues, product?: RetailProduct | null) {
  if (values.costMode === 'direct') {
    if (!values.directCostItemId) throw new Error('Selecione o item de custo direto.');
    return { costMode: 'direct' as const, directCostItemId: values.directCostItemId };
  }
  if (values.costMode === 'composition') {
    return {
      costMode: 'composition' as const,
      ...(product?.compositionVersionId
        ? { compositionVersionId: product.compositionVersionId }
        : {}),
    };
  }
  return {};
}

function productCostFormValues(
  product?: RetailProduct | null,
): Partial<NativeRetailProductCostFormValues> {
  return product
    ? {
        costMode: product.costMode ?? '',
        directCostItemId: product.directCostItemId ?? '',
      }
    : {};
}

export default function RetailCategoryProductsRoute() {
  const { mode } = useAppMode();
  const { theme, resolvedMode } = useAppTheme();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();
  const {
    categories: allCategories,
    error: categoryError,
    loading: categoriesLoading,
    reload: reloadCategories,
  } = useRetailCategories({ includeInactive: true });
  const {
    error: productError,
    loading: productsLoading,
    products,
    reload: reloadProducts,
    remove,
    create,
    update,
  } = useRetailProducts({ categoryId });
  const { items: costItems } = useRetailCostItems({ includeInactive: true });
  const [formVisible, setFormVisible] = useState(false);
  const [productToEdit, setProductToEdit] = useState<RetailProduct | null>(null);
  const [productForCost, setProductForCost] = useState<RetailProduct | null>(null);
  const [productForComposition, setProductForComposition] = useState<RetailProduct | null>(null);
  const [productToDisable, setProductToDisable] = useState<RetailProduct | null>(null);
  const [mutationError, setMutationError] = useState<string>();
  const [disabling, setDisabling] = useState(false);
  const { createVersion, versions: compositionVersions } = useRetailCompositions(
    productForComposition?.productId,
  );

  const category = useMemo(
    () => allCategories.find((candidate) => candidate.categoryId === categoryId),
    [allCategories, categoryId],
  );
  const categoryOptions = useMemo<readonly NativeRetailProductCategoryOption[]>(
    () =>
      allCategories
        .filter((candidate) => candidate.active)
        .map(({ categoryId: id, label }) => ({ categoryId: id, label })),
    [allCategories],
  );

  const openCreate = useCallback(() => {
    setProductToEdit(null);
    setFormVisible(true);
  }, []);
  const openEdit = useCallback((product: RetailProduct) => {
    setMutationError(undefined);
    setProductToEdit(product);
    setFormVisible(true);
  }, []);
  const submitProduct = useCallback(
    async (values: NativeRetailProductFormValues) => {
      if (testModeEnabled) return;
      const draft = toProductDraft(values, categoryOptions);
      const costDraft = productCostDraft(values, productToEdit);
      if (productToEdit) {
        await update(productToEdit.productId, {
          ...draft,
          ...costDraft,
          costMode: values.costMode || null,
          directCostItemId: values.costMode === 'direct' ? values.directCostItemId || null : null,
          compositionVersionId:
            values.costMode === 'composition' ? (productToEdit.compositionVersionId ?? null) : null,
        });
      } else {
        await create({ ...draft, ...costDraft });
      }
    },
    [categoryOptions, create, productToEdit, testModeEnabled, update],
  );
  const disableProduct = useCallback(async () => {
    if (!productToDisable || disabling || testModeEnabled) return;
    setDisabling(true);
    setMutationError(undefined);
    try {
      await remove(productToDisable.productId);
      setProductToDisable(null);
    } catch (disableError) {
      setMutationError(
        disableError instanceof Error
          ? disableError.message
          : 'Não foi possível desativar o produto.',
      );
    } finally {
      setDisabling(false);
    }
  }, [disabling, productToDisable, remove, testModeEnabled]);

  const costItemOptions = useMemo<readonly NativeRetailProductCostItemOption[]>(
    () =>
      costItems
        .filter(
          (item) =>
            item.active ||
            item.costItemId === productForCost?.directCostItemId ||
            item.costItemId === productToEdit?.directCostItemId,
        )
        .map((item) => ({
          costItemId: item.costItemId,
          label: item.active ? item.name : `${item.name} (desativado)`,
          unit: item.unit,
        })),
    [costItems, productForCost?.directCostItemId, productToEdit?.directCostItemId],
  );
  const compositionCostItemOptions = useMemo<readonly NativeRetailCompositionCostItemOption[]>(
    () =>
      costItems.map((item) => ({
        costItemId: item.costItemId,
        label: item.active ? item.name : `${item.name} (desativado)`,
        unit: item.unit,
      })),
    [costItems],
  );
  const costItemsById = useMemo(
    () =>
      new Map<string, RetailCostItem>(costItems.map((item) => [item.costItemId, item] as const)),
    [costItems],
  );
  const selectedComposition = useMemo(
    () =>
      productForComposition
        ? (compositionVersions.find(
            (version) =>
              version.compositionVersionId === productForComposition.compositionVersionId,
          ) ?? compositionVersions[0])
        : undefined,
    [compositionVersions, productForComposition],
  );
  const compositionInitialValues = useMemo<Partial<NativeRetailCompositionFormValues>>(
    () => ({
      components:
        selectedComposition?.components.map((component, index) => ({
          key: `existing-component-${index}`,
          costItemId: component.costItemId,
          quantity: String(component.quantity),
        })) ?? [],
      effectiveFrom: todayIso(),
    }),
    [selectedComposition],
  );

  const submitProductCost = useCallback(
    async (values: NativeRetailProductCostFormValues) => {
      if (!productForCost || testModeEnabled) return;
      if (values.costMode === 'direct') {
        if (!values.directCostItemId) throw new Error('Selecione o item de custo direto.');
        await update(productForCost.productId, {
          compositionVersionId: null,
          costMode: 'direct',
          directCostItemId: values.directCostItemId,
        });
        return;
      }
      if (values.costMode === 'composition') {
        if (!productForCost.compositionVersionId) {
          throw new Error('Crie uma composição antes de selecionar esse modo de custo.');
        }
        await update(productForCost.productId, {
          compositionVersionId: productForCost.compositionVersionId,
          costMode: 'composition',
          directCostItemId: null,
        });
        return;
      }
      await update(productForCost.productId, {
        compositionVersionId: null,
        costMode: null,
        directCostItemId: null,
      });
    },
    [productForCost, testModeEnabled, update],
  );

  const submitComposition = useCallback(
    async (values: NativeRetailCompositionFormValues) => {
      if (!productForComposition || testModeEnabled) return;
      const components = values.components.map((component) => {
        const item = costItemsById.get(component.costItemId);
        if (!item) throw new Error('Um componente selecionado não foi encontrado.');
        return {
          costItemId: item.costItemId,
          costItemNameSnapshot: item.name,
          quantity: normalizeRetailQuantity(component.quantity, `A quantidade de ${item.name}`),
          unit: item.unit,
        };
      });
      const compositionVersionId = await createVersion(
        { components, effectiveFrom: values.effectiveFrom },
        costItemsById,
      );
      await update(productForComposition.productId, {
        compositionVersionId,
        costMode: 'composition',
        directCostItemId: null,
      });
    },
    [costItemsById, createVersion, productForComposition, testModeEnabled, update],
  );

  const cardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const cardRadius = theme.radius.xl + theme.spacing.sm;
  const rowHeight = theme.sizes.touchTargetMinimum + theme.spacing.sm * 2;

  return (
    <>
      {mode === 'retail' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel="Novo produto"
            icon="plus"
            onPress={openCreate}
          />
        </Stack.Toolbar>
      ) : null}
      <PremiumScreen
        contentContainerStyle={[styles.content, { backgroundColor: theme.colors.background }]}
        overlayHeader={
          <NativeGlassHeader mode="transparent" title={category?.label ?? 'Produtos'} />
        }
        progressiveBlur
      >
        {mode !== 'retail' ? (
          <EmptyState
            description="Alterne para Varejo para acessar o catálogo."
            title="Catálogo Varejo"
          />
        ) : categoriesLoading || productsLoading ? (
          <Loading label="Carregando produtos" />
        ) : categoryError || productError ? (
          <ErrorState
            description={categoryError ?? productError}
            onRetry={() => {
              void reloadCategories();
              void reloadProducts();
            }}
            title="Não foi possível carregar"
          />
        ) : !category ? (
          <EmptyState title="Categoria não encontrada" />
        ) : (
          <View style={{ marginTop: theme.spacing.xl }}>
            <PremiumCard style={{ borderRadius: cardRadius, padding: theme.spacing.sm }}>
              {mutationError ? (
                <Text
                  style={[
                    theme.typography.footnote,
                    styles.mutationError,
                    { color: theme.colors.danger },
                  ]}
                >
                  {mutationError}
                </Text>
              ) : null}
              {products.length ? (
                products.map((product) => {
                  const subtitle = [product.variant, product.flavor, product.packageSize]
                    .filter(Boolean)
                    .join(' · ');
                  const hasCostConfiguration =
                    (product.costMode === 'direct' && Boolean(product.directCostItemId)) ||
                    (product.costMode === 'composition' && Boolean(product.compositionVersionId));
                  const costStatus = hasCostConfiguration
                    ? product.costMode === 'direct'
                      ? 'Custo direto configurado'
                      : 'Composição configurada'
                    : 'Custo não configurado';
                  const costActionLabel = hasCostConfiguration
                    ? 'Editar custo'
                    : 'Configurar custo';
                  const renderRow = (preview = false) => (
                    <View
                      style={[
                        styles.row,
                        {
                          backgroundColor: preview ? cardSurface : 'transparent',
                          borderRadius: cardRadius,
                          height: rowHeight,
                          overflow: preview ? 'hidden' : undefined,
                          width: '100%',
                        },
                      ]}
                    >
                      <ListItem
                        accessibilityLabel={product.productName}
                        leading={
                          <View style={styles.iconSlot}>
                            <SettingsIcon
                              color={theme.colors.textPrimary}
                              fallbackIcon="cube-outline"
                              size={theme.sizes.iconMedium}
                              systemName="shippingbox"
                            />
                          </View>
                        }
                        onPress={() => openEdit(product)}
                        style={{ height: rowHeight, width: '100%' }}
                        subtitle={subtitle || undefined}
                        title={product.productName}
                        trailing={
                          <Text
                            style={[
                              theme.typography.footnote,
                              { color: theme.colors.textSecondary },
                            ]}
                          >
                            {formatCurrency(product.standardSalePrice)}
                          </Text>
                        }
                      />
                    </View>
                  );
                  return (
                    <View
                      key={product.productId}
                      style={{
                        backgroundColor: cardSurface,
                        borderRadius: cardRadius,
                        height: rowHeight,
                        overflow: 'hidden',
                        width: '100%',
                      }}
                    >
                      <NativeCardContextMenu
                        actions={[
                          {
                            id: 'configure-product-cost',
                            onPress: () => setProductForCost(product),
                            systemImage: 'dollarsign.circle',
                            title: 'Configurar custo',
                          },
                          {
                            id: 'edit-product-composition',
                            onPress: () => setProductForComposition(product),
                            systemImage: 'square.stack.3d.up',
                            title: 'Editar composição',
                          },
                          {
                            id: 'edit-product',
                            onPress: () => openEdit(product),
                            systemImage: 'pencil',
                            title: 'Editar produto',
                          },
                          {
                            destructive: true,
                            disabled: testModeEnabled,
                            id: 'disable-product',
                            onPress: () => setProductToDisable(product),
                            systemImage: 'nosign',
                            title: 'Desativar produto',
                          },
                        ]}
                        matchContents={{ horizontal: true, vertical: false }}
                        preview={renderRow(true)}
                        style={{ borderRadius: cardRadius, height: rowHeight, width: '100%' }}
                      >
                        {renderRow()}
                      </NativeCardContextMenu>
                      <View
                        style={[
                          styles.costActionRow,
                          {
                            borderTopColor: theme.colors.separator,
                            paddingHorizontal: theme.spacing.sm,
                          },
                        ]}
                      >
                        <Text
                          style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
                        >
                          {costStatus}
                        </Text>
                        <TextButton
                          accessibilityLabel={`${costActionLabel} de ${product.productName}`}
                          label={costActionLabel}
                          onPress={() => setProductForCost(product)}
                          size="small"
                        />
                      </View>
                    </View>
                  );
                })
              ) : (
                <EmptyState
                  actionLabel="Novo produto"
                  description="Cadastre cada combinação vendável como um SKU independente."
                  onActionPress={openCreate}
                  title="Nenhum produto ativo"
                />
              )}
            </PremiumCard>
          </View>
        )}
      </PremiumScreen>
      <NativeRetailProductFormSheet
        categories={categoryOptions}
        costItems={costItemOptions}
        initialValues={productFormValues(productToEdit)}
        mode={productToEdit ? 'edit' : 'create'}
        onSubmit={submitProduct}
        onVisibleChange={setFormVisible}
        onOpenComposition={
          productToEdit
            ? () => {
                setFormVisible(false);
                setProductForComposition(productToEdit);
              }
            : undefined
        }
        visible={formVisible}
      />
      <NativeRetailProductCostSheet
        costItems={costItemOptions}
        initialValues={productCostFormValues(productForCost)}
        onOpenComposition={() => {
          if (productForCost) {
            setProductForComposition(productForCost);
            setProductForCost(null);
          }
        }}
        onSubmit={submitProductCost}
        onVisibleChange={(visible) => {
          if (!visible) setProductForCost(null);
        }}
        visible={Boolean(productForCost)}
      />
      <NativeRetailCompositionSheet
        costItems={compositionCostItemOptions}
        initialValues={compositionInitialValues}
        onSubmit={submitComposition}
        onVisibleChange={(visible) => {
          if (!visible) setProductForComposition(null);
        }}
        visible={Boolean(productForComposition)}
      />
      <ConfirmationDialog
        confirmLabel="Desativar produto"
        destructive
        loading={disabling}
        message="O produto ficará fora de novas vendas. Pedidos futuros deverão usar outro SKU; dados históricos permanecerão preservados."
        onCancel={() => setProductToDisable(null)}
        onConfirm={() => void disableProduct()}
        title="Desativar produto"
        visible={Boolean(productToDisable)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  costActionRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconSlot: { alignItems: 'center', justifyContent: 'center', width: 34 },
  mutationError: { marginBottom: 12, paddingHorizontal: 8 },
  row: { width: '100%' },
});
