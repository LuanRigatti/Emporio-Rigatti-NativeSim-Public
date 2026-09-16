import { Stack, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { ListItem } from '@/components/lists';
import {
  NativeCardContextMenu,
  NativeRetailCostItemFormSheet,
  type NativeRetailCostItemFormValues,
} from '@/components/native';
import { ConfirmationDialog } from '@/components/overlays';
import { EmptyState, ErrorState, Loading, PremiumCard, PremiumScreen } from '@/components/premium';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import SettingsIcon from '@/features/settings/components/SettingsIcon';
import { useRetailCostItems } from '@/hooks/useRetailCostItems';
import { useAppMode } from '@/providers';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import type { RetailCostItem, RetailCostItemDraft } from '@/types/data';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

function toDraft(values: NativeRetailCostItemFormValues): RetailCostItemDraft {
  return {
    name: values.name,
    supplier: values.supplier,
    unit: values.unit,
  };
}

function formValues(item?: RetailCostItem | null): Partial<NativeRetailCostItemFormValues> {
  return item ? { name: item.name, supplier: item.supplier ?? '', unit: item.unit } : {};
}

export default function RetailCostsRoute() {
  const { mode } = useAppMode();
  const { resolvedMode, theme } = useAppTheme();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const router = useRouter();
  const { create, error, items, loading, reload, remove, update } = useRetailCostItems();
  const [formVisible, setFormVisible] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<RetailCostItem | null>(null);
  const [itemToDisable, setItemToDisable] = useState<RetailCostItem | null>(null);
  const [mutationError, setMutationError] = useState<string>();
  const [disabling, setDisabling] = useState(false);

  const openCreate = useCallback(() => {
    triggerLightImpactHaptic();
    setItemToEdit(null);
    setMutationError(undefined);
    setFormVisible(true);
  }, []);

  const openEdit = useCallback((item: RetailCostItem) => {
    setItemToEdit(item);
    setMutationError(undefined);
    setFormVisible(true);
  }, []);

  const handleSubmit = useCallback(
    async (values: NativeRetailCostItemFormValues) => {
      if (testModeEnabled) return;
      if (itemToEdit) await update(itemToEdit.costItemId, toDraft(values));
      else await create(toDraft(values));
    },
    [create, itemToEdit, testModeEnabled, update],
  );

  const handleDisable = useCallback(async () => {
    if (!itemToDisable || testModeEnabled || disabling) return;
    setDisabling(true);
    setMutationError(undefined);
    try {
      await remove(itemToDisable.costItemId);
      setItemToDisable(null);
    } catch (disableError) {
      setMutationError(
        disableError instanceof Error
          ? disableError.message
          : 'Não foi possível desativar o item de custo.',
      );
    } finally {
      setDisabling(false);
    }
  }, [disabling, itemToDisable, remove, testModeEnabled]);

  const cardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const cardRadius = theme.radius.xl + theme.spacing.sm;
  const rowHeight = theme.sizes.touchTargetMinimum + theme.spacing.sm * 2;

  return (
    <>
      {mode === 'retail' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel="Novo item de custo"
            icon="plus"
            onPress={openCreate}
          />
        </Stack.Toolbar>
      ) : null}
      <PremiumScreen
        contentContainerStyle={[styles.content, { backgroundColor: theme.colors.background }]}
        overlayHeader={<NativeGlassHeader mode="transparent" title="Custos" />}
        progressiveBlur
      >
        {mode !== 'retail' ? (
          <EmptyState
            description="Alterne para Varejo para gerenciar os custos históricos."
            title="Custos Varejo"
          />
        ) : loading ? (
          <Loading label="Carregando itens de custo" />
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
                  style={[theme.typography.footnote, styles.error, { color: theme.colors.danger }]}
                >
                  {mutationError}
                </Text>
              ) : null}
              {items.length ? (
                <SettingsSection>
                  {items.map((item) => {
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
                          accessibilityLabel={`${item.name}, unidade ${item.unit}`}
                          leading={
                            <View style={styles.iconSlot}>
                              <SettingsIcon
                                color={theme.colors.textPrimary}
                                fallbackIcon="calculator-outline"
                                size={theme.sizes.iconMedium}
                                systemName="shippingbox"
                              />
                            </View>
                          }
                          onPress={() =>
                            router.push({
                              params: { costItemId: item.costItemId },
                              pathname: '/custos-varejo/[costItemId]',
                            })
                          }
                          style={{ height: rowHeight, width: '100%' }}
                          subtitle={`Unidade: ${item.unit}`}
                          title={item.name}
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
                        key={item.costItemId}
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
                              id: 'edit-cost-item',
                              onPress: () => openEdit(item),
                              systemImage: 'pencil',
                              title: 'Editar item de custo',
                            },
                            {
                              destructive: true,
                              disabled: testModeEnabled,
                              id: 'disable-cost-item',
                              onPress: () => setItemToDisable(item),
                              systemImage: 'nosign',
                              title: 'Desativar item',
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
                  actionLabel="Novo item de custo"
                  description="Cadastre materiais e produtos comprados para registrar seu histórico por data."
                  onActionPress={openCreate}
                  title="Nenhum item de custo"
                />
              )}
            </PremiumCard>
          </View>
        )}
      </PremiumScreen>
      <NativeRetailCostItemFormSheet
        initialValues={formValues(itemToEdit)}
        mode={itemToEdit ? 'edit' : 'create'}
        onSubmit={handleSubmit}
        onVisibleChange={setFormVisible}
        visible={formVisible}
      />
      <ConfirmationDialog
        confirmLabel="Desativar item"
        destructive
        loading={disabling}
        message="O item ficará fora de novas configurações. Entradas e composições históricas permanecerão preservadas."
        onCancel={() => setItemToDisable(null)}
        onConfirm={() => void handleDisable()}
        title="Desativar item de custo"
        visible={Boolean(itemToDisable)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chevronSlot: { alignItems: 'center', justifyContent: 'center', width: 34 },
  content: { flexGrow: 1 },
  error: { marginBottom: 12, paddingHorizontal: 8 },
  iconSlot: { alignItems: 'center', justifyContent: 'center', width: 34 },
  row: { width: '100%' },
});
