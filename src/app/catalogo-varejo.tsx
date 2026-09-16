import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ListItem } from '@/components/lists';
import { NativeCardContextMenu, NativeRetailCategoryFormSheet } from '@/components/native';
import { NativeGlassHeader } from '@/components/layout';
import { ConfirmationDialog } from '@/components/overlays';
import { EmptyState, ErrorState, Loading, PremiumCard, PremiumScreen } from '@/components/premium';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import { useRetailCategories } from '@/hooks/useRetailCategories';
import { useRetailProducts } from '@/hooks/useRetailProducts';
import { useAppMode } from '@/providers';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import type { RetailCategory } from '@/types/data';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import SettingsIcon from '@/features/settings/components/SettingsIcon';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function RetailCatalogRoute() {
  const { mode } = useAppMode();
  const { resolvedMode, theme } = useAppTheme();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const router = useRouter();
  const { categories, create, ensureInitialCategories, error, loading, reload, remove, update } =
    useRetailCategories();
  const {
    error: productsError,
    loading: productsLoading,
    products,
  } = useRetailProducts({ includeInactive: true });
  const [formVisible, setFormVisible] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<RetailCategory | null>(null);
  const [categoryToDisable, setCategoryToDisable] = useState<RetailCategory | null>(null);
  const [mutationError, setMutationError] = useState<string>();
  const [seeding, setSeeding] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const openCreate = useCallback(() => {
    triggerLightImpactHaptic();
    setCategoryToEdit(null);
    setFormVisible(true);
  }, []);

  const openEdit = useCallback((category: RetailCategory) => {
    setMutationError(undefined);
    setCategoryToEdit(category);
    setFormVisible(true);
  }, []);

  const handleCategorySubmit = useCallback(
    async (values: { label: string }) => {
      if (testModeEnabled) return;
      if (categoryToEdit) await update(categoryToEdit.categoryId, { label: values.label });
      else await create({ label: values.label });
    },
    [categoryToEdit, create, testModeEnabled, update],
  );

  const handleSeed = useCallback(async () => {
    if (testModeEnabled || seeding) return;
    setSeeding(true);
    setMutationError(undefined);
    try {
      await ensureInitialCategories();
    } catch (seedError) {
      setMutationError(
        seedError instanceof Error ? seedError.message : 'Não foi possível criar as categorias.',
      );
    } finally {
      setSeeding(false);
    }
  }, [ensureInitialCategories, seeding, testModeEnabled]);

  const handleDisable = useCallback(async () => {
    if (!categoryToDisable || testModeEnabled || disabling) return;
    if (
      products.some(
        (product) => product.categoryId === categoryToDisable.categoryId && product.active,
      )
    ) {
      setMutationError('Mova ou desative os produtos ativos antes de desativar esta categoria.');
      setCategoryToDisable(null);
      return;
    }
    setDisabling(true);
    setMutationError(undefined);
    try {
      await remove(categoryToDisable.categoryId);
      setCategoryToDisable(null);
    } catch (disableError) {
      setMutationError(
        disableError instanceof Error
          ? disableError.message
          : 'Não foi possível desativar a categoria.',
      );
    } finally {
      setDisabling(false);
    }
  }, [categoryToDisable, disabling, products, remove, testModeEnabled]);

  const cardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const cardRadius = theme.radius.xl + theme.spacing.sm;
  const rowHeight = theme.sizes.touchTargetMinimum + theme.spacing.sm * 2;

  return (
    <>
      {mode === 'retail' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel="Nova categoria"
            icon="plus"
            onPress={openCreate}
          />
        </Stack.Toolbar>
      ) : null}
      <PremiumScreen
        contentContainerStyle={[styles.content, { backgroundColor: theme.colors.background }]}
        overlayHeader={<NativeGlassHeader mode="transparent" title="Catálogo" />}
        progressiveBlur
      >
        {mode !== 'retail' ? (
          <EmptyState
            description="Alterne para Varejo para gerenciar categorias e produtos."
            title="Catálogo Varejo"
          />
        ) : loading ? (
          <Loading label="Carregando categorias" />
        ) : error ? (
          <ErrorState
            description={error}
            onRetry={() => void reload()}
            title="Não foi possível carregar"
          />
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
              {categories.length ? (
                <SettingsSection>
                  {categories.map((category) => {
                    const activeProducts = products.some(
                      (product) => product.categoryId === category.categoryId && product.active,
                    );
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
                          accessibilityLabel={category.label}
                          leading={
                            <View style={styles.iconSlot}>
                              <SettingsIcon
                                color={theme.colors.textPrimary}
                                fallbackIcon="folder-outline"
                                size={theme.sizes.iconMedium}
                                systemName="folder"
                              />
                            </View>
                          }
                          onPress={() =>
                            router.push({
                              params: { categoryId: category.categoryId },
                              pathname: '/catalogo-varejo/[categoryId]',
                            })
                          }
                          style={{ height: rowHeight, width: '100%' }}
                          title={category.label}
                          trailing={
                            <View style={styles.chevronSlot}>
                              <Ionicons
                                color={theme.colors.textTertiary}
                                name="chevron-forward"
                                size={theme.sizes.iconSmall}
                              />
                            </View>
                          }
                        />
                      </View>
                    );
                    return (
                      <View
                        key={category.categoryId}
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
                              id: 'edit-category',
                              onPress: () => openEdit(category),
                              systemImage: 'pencil',
                              title: 'Editar categoria',
                            },
                            {
                              disabled:
                                testModeEnabled ||
                                productsLoading ||
                                Boolean(productsError) ||
                                activeProducts,
                              id: 'disable-category',
                              onPress: () => setCategoryToDisable(category),
                              systemImage: 'nosign',
                              title: 'Desativar categoria',
                            },
                          ]}
                          matchContents={{ horizontal: true, vertical: false }}
                          preview={renderRow(true)}
                          style={{ borderRadius: cardRadius, height: rowHeight, width: '100%' }}
                        >
                          {renderRow()}
                        </NativeCardContextMenu>
                      </View>
                    );
                  })}
                </SettingsSection>
              ) : (
                <EmptyState
                  actionLabel={seeding ? 'Criando...' : 'Criar categorias iniciais'}
                  description="Comece com Cestas, Salgados e Baldes. Você poderá criar outras categorias depois."
                  onActionPress={() => void handleSeed()}
                  title="Nenhuma categoria cadastrada"
                />
              )}
            </PremiumCard>
          </View>
        )}
      </PremiumScreen>
      <NativeRetailCategoryFormSheet
        initialValues={categoryToEdit ? { label: categoryToEdit.label } : undefined}
        mode={categoryToEdit ? 'edit' : 'create'}
        onSubmit={handleCategorySubmit}
        onVisibleChange={setFormVisible}
        visible={formVisible}
      />
      <ConfirmationDialog
        confirmLabel="Desativar categoria"
        destructive
        loading={disabling}
        message="A categoria ficará fora da lista de novas vendas. Produtos históricos continuarão preservados."
        onCancel={() => setCategoryToDisable(null)}
        onConfirm={() => void handleDisable()}
        title="Desativar categoria"
        visible={Boolean(categoryToDisable)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chevronSlot: { alignItems: 'center', justifyContent: 'center', width: 34 },
  content: { flexGrow: 1 },
  iconSlot: { alignItems: 'center', justifyContent: 'center', width: 34 },
  mutationError: { marginBottom: 12, paddingHorizontal: 8 },
  row: { width: '100%' },
});
