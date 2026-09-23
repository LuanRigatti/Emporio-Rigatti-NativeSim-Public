import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TextButton } from '@/components/buttons';
import { ListItem } from '@/components/lists';
import { NativeCardContextMenu } from '@/components/native';
import { NativeGlassHeader } from '@/components/layout';
import { ConfirmationDialog } from '@/components/overlays';
import { EmptyState, ErrorState, Loading, PremiumCard, PremiumScreen } from '@/components/premium';
import { useRetailCategories } from '@/hooks/useRetailCategories';
import { useRetailProducts } from '@/hooks/useRetailProducts';
import { useAppMode } from '@/providers';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import type { RetailProduct } from '@/types/data';
import { formatCurrency } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import SettingsIcon from '@/features/settings/components/SettingsIcon';

export default function RetailCategoryProductsRoute() {
  const { mode } = useAppMode();
  const { theme, resolvedMode } = useAppTheme();
  const router = useRouter();
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
  } = useRetailProducts({ categoryId });
  const [productToDisable, setProductToDisable] = useState<RetailProduct | null>(null);
  const [mutationError, setMutationError] = useState<string>();
  const [disabling, setDisabling] = useState(false);

  const category = useMemo(
    () => allCategories.find((candidate) => candidate.categoryId === categoryId),
    [allCategories, categoryId],
  );
  const openCreate = useCallback(() => {
    router.push({
      pathname: '/catalogo-varejo/produto/novo',
      params: { categoryId },
    });
  }, [categoryId, router]);
  const openEdit = useCallback(
    (product: RetailProduct) => {
      router.push({
        pathname: '/catalogo-varejo/produto/[productId]',
        params: { productId: product.productId },
      });
    },
    [router],
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
                            onPress: () => openEdit(product),
                            systemImage: 'dollarsign.circle',
                            title: 'Configurar custo',
                          },
                          {
                            id: 'edit-product-composition',
                            onPress: () => openEdit(product),
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
                          onPress={() => openEdit(product)}
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
