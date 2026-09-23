import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove, type NavigationAction } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { InlineError } from '@/components/feedback';
import { NativeGlassHeader } from '@/components/layout';
import { NativeButton, NativeDatePicker, NativeDropdown } from '@/components/native';
import { ConfirmationDialog } from '@/components/overlays';
import {
  EmptyState,
  ErrorState,
  Loading,
  PremiumCard,
  PremiumScreen,
  PremiumSection,
} from '@/components/premium';
import { useRetailCompositions } from '@/hooks/useRetailCompositions';
import { useRetailCostItems } from '@/hooks/useRetailCostItems';
import { useRetailProducts } from '@/hooks/useRetailProducts';
import { useAppMode } from '@/providers';
import {
  getRetailCompositionComponentIdIssues,
  normalizeRetailQuantity,
  type RetailCompositionCostItem,
} from '@/services/retail-costs';
import { useAppTheme } from '@/theme';
import type { RetailCompositionVersion, RetailCostItem } from '@/types/data';
import { parseIsoCalendarDate, todayIso } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import { RetailCatalogLabeledTextField } from './RetailCatalogLabeledTextField';

type RetailCompositionEditScreenProps = { productId?: string };

type ComponentDraft = { key: string; costItemId: string; quantity: string };
type CompositionDraft = { effectiveFrom: string; components: ComponentDraft[] };

function compositionOptionLabel(
  item: { active: boolean; costItemId: string; name: string; unit: string },
  items: readonly RetailCostItem[],
): string {
  const sameName = items.filter(
    (candidate) =>
      candidate.name.trim().toLocaleLowerCase('pt-BR') ===
      item.name.trim().toLocaleLowerCase('pt-BR'),
  );
  const unitSuffix = sameName.length > 1 ? ` — ${item.unit}` : '';
  return `${item.name}${unitSuffix}${item.active ? '' : ' (desativado)'}`;
}

function componentValues(version?: RetailCompositionVersion): ComponentDraft[] {
  return (
    version?.components.map((component, index) => ({
      costItemId: component.costItemId,
      key: `existing-component-${index}`,
      quantity: String(component.quantity),
    })) ?? []
  );
}

function draftKey(draft: CompositionDraft): string {
  return JSON.stringify(draft);
}

export function RetailCompositionEditScreen({ productId }: RetailCompositionEditScreenProps) {
  const { theme } = useAppTheme();
  const { mode } = useAppMode();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const router = useRouter();
  const navigation = useNavigation();
  const { error: productsError, loading: productsLoading, products, update } = useRetailProducts();
  const {
    items: costItems,
    error: costItemsError,
    loading: costItemsLoading,
  } = useRetailCostItems({
    includeInactive: true,
  });
  const {
    createVersion,
    error: compositionsError,
    loading: compositionsLoading,
    versions,
  } = useRetailCompositions(productId);
  const product = useMemo(
    () => products.find((candidate) => candidate.productId === productId),
    [productId, products],
  );
  const selectedVersion = useMemo(
    () =>
      product
        ? (versions.find(
            (version) => version.compositionVersionId === product.compositionVersionId,
          ) ?? versions[0])
        : undefined,
    [product, versions],
  );
  const [draft, setDraft] = useState<CompositionDraft>();
  const [initialDraft, setInitialDraft] = useState<CompositionDraft>();
  const [initializedKey, setInitializedKey] = useState<string>();
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [allowNextRemove, setAllowNextRemove] = useState(false);
  const pendingRemoveActionRef = useRef<NavigationAction | null>(null);
  const nextKeyRef = useRef(0);

  const sourceKey = `${productId ?? ''}|${selectedVersion?.compositionVersionId ?? 'new'}|${versions.length}|${selectedVersion?.effectiveFrom ?? ''}`;
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!product || initializedKey === sourceKey) return;
    const nextDraft: CompositionDraft = {
      components: componentValues(selectedVersion),
      effectiveFrom: todayIso(),
    };
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
    setInitializedKey(sourceKey);
    nextKeyRef.current = nextDraft.components.length;
  }, [initializedKey, product, selectedVersion, sourceKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const hasPendingChanges = Boolean(
    !testModeEnabled && draft && initialDraft && draftKey(draft) !== draftKey(initialDraft),
  );
  const componentIdIssues = useMemo(
    () => getRetailCompositionComponentIdIssues(draft?.components ?? []),
    [draft],
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

  const compositionItemsById = useMemo(() => {
    const items = new Map<string, RetailCompositionCostItem>(
      costItems.map((item) => [item.costItemId, item] as const),
    );
    selectedVersion?.components.forEach((component) => {
      const costItemId = component.costItemId.trim();
      if (!costItemId || items.has(costItemId)) return;
      items.set(costItemId, {
        costItemId,
        name: component.costItemNameSnapshot,
        unit: component.unit,
      });
    });
    return items;
  }, [costItems, selectedVersion]);

  const updateComponent = useCallback(
    (key: string, patch: Partial<ComponentDraft>) => {
      if (!draft) return;
      const nextCostItemId = patch.costItemId?.trim();
      if (
        nextCostItemId &&
        draft.components.some(
          (component) => component.key !== key && component.costItemId.trim() === nextCostItemId,
        )
      ) {
        setError('Esse item de custo já está na composição.');
        return;
      }
      setError(undefined);
      setDraft((current) =>
        current
          ? {
              ...current,
              components: current.components.map((component) =>
                component.key === key ? { ...component, ...patch } : component,
              ),
            }
          : current,
      );
    },
    [draft],
  );

  const addComponent = useCallback(() => {
    if (!draft) return;
    const selectedIds = new Set(
      draft.components.map((component) => component.costItemId.trim()).filter(Boolean),
    );
    const item = costItems.find(
      (candidate) => candidate.active && !selectedIds.has(candidate.costItemId),
    );
    if (!item) {
      setError(
        costItems.some((candidate) => candidate.active)
          ? 'Cada item de custo só pode aparecer uma vez.'
          : 'Cadastre itens de custo antes de criar a composição.',
      );
      return;
    }
    setError(undefined);
    setDraft((current) =>
      current
        ? {
            ...current,
            components: [
              ...current.components,
              {
                key: `component-${nextKeyRef.current++}`,
                costItemId: item.costItemId,
                quantity: '1',
              },
            ],
          }
        : current,
    );
  }, [costItems, draft]);

  const save = useCallback(async () => {
    if (!product || !draft || isSaving || testModeEnabled) return;
    if (!draft.components.length) {
      setError('Adicione ao menos um componente à composição.');
      return;
    }
    if (componentIdIssues.emptyIndexes.length) {
      setError('Selecione um item de custo para cada componente.');
      return;
    }
    if (draft.components.some((component) => !component.quantity.trim())) {
      setError('Informe a quantidade de cada componente.');
      return;
    }
    if (componentIdIssues.duplicateIds.length) {
      setError('Cada item de custo só pode aparecer uma vez.');
      return;
    }
    setError(undefined);
    setIsSaving(true);
    Keyboard.dismiss();
    try {
      const components = draft.components.map((component) => {
        const item = compositionItemsById.get(component.costItemId.trim());
        if (!item) throw new Error('Um componente selecionado não foi encontrado.');
        return {
          costItemId: item.costItemId,
          costItemNameSnapshot: item.name,
          quantity: normalizeRetailQuantity(component.quantity, `A quantidade de ${item.name}`),
          unit: item.unit,
        };
      });
      const compositionVersionId = await createVersion(
        { components, effectiveFrom: draft.effectiveFrom },
        compositionItemsById,
      );
      await update(product.productId, {
        compositionVersionId,
        costMode: 'composition',
        directCostItemId: null,
      });
      setInitialDraft(draft);
      router.back();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Não foi possível salvar a composição.',
      );
      setIsSaving(false);
    }
  }, [
    compositionItemsById,
    componentIdIssues,
    createVersion,
    draft,
    isSaving,
    product,
    router,
    testModeEnabled,
    update,
  ]);

  const disabled = testModeEnabled || isSaving;
  const optionItems = costItems.filter((item) => item.active);

  if (mode !== 'retail') {
    return (
      <EmptyState
        description="Alterne para Varejo para editar composições."
        title="Catálogo Varejo"
      />
    );
  }
  if (productsLoading || costItemsLoading || compositionsLoading || !draft) {
    return <Loading label="Carregando composição" />;
  }
  if (productsError || costItemsError || compositionsError) {
    return (
      <ErrorState
        description={productsError ?? costItemsError ?? compositionsError}
        title="Não foi possível carregar"
      />
    );
  }
  if (!product) {
    return <EmptyState title="Produto não encontrado" />;
  }

  return (
    <>
      <PremiumScreen
        contentContainerStyle={[styles.content, { backgroundColor: theme.colors.background }]}
        overlayHeader={<NativeGlassHeader mode="transparent" title="Composição" />}
        progressiveBlur
      >
        <View style={{ height: theme.sizes.touchTargetMinimum }} />
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          {product.productName}
        </Text>
        <PremiumSection title="Vigência">
          <PremiumCard style={styles.card}>
            <View style={styles.dateRow}>
              <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                Vigente desde
              </Text>
              <NativeDatePicker
                accessibilityLabel="Vigente desde da composição"
                mode="date"
                onChange={(date) =>
                  setDraft((current) =>
                    current ? { ...current, effectiveFrom: todayIso(date) } : current,
                  )
                }
                style="compact"
                value={parseIsoCalendarDate(draft.effectiveFrom) ?? new Date()}
              />
            </View>
          </PremiumCard>
        </PremiumSection>
        <PremiumSection title="Componentes">
          <View style={styles.componentList}>
            {draft.components.map((component, index) => {
              const costItemId = component.costItemId.trim();
              const selectedItem = costItemId ? compositionItemsById.get(costItemId) : undefined;
              const itemsForComponent = [
                ...optionItems,
                ...(selectedItem &&
                !optionItems.some((item) => item.costItemId === selectedItem.costItemId)
                  ? [{ ...selectedItem, active: false }]
                  : []),
              ];
              const selectedItemOption = itemsForComponent.find(
                (item) => item.costItemId === costItemId,
              );
              const hasMissingItem = componentIdIssues.emptyIndexes.includes(index);
              const hasDuplicateItem = componentIdIssues.duplicateIds.includes(costItemId);
              return (
                <PremiumCard key={component.key} style={styles.card}>
                  <NativeDropdown
                    accessibilityLabel="Item do componente"
                    disabled={disabled || !itemsForComponent.length}
                    items={itemsForComponent.map((item) => ({
                      label: compositionOptionLabel(item, costItems),
                      value: item.costItemId,
                    }))}
                    label={
                      selectedItemOption
                        ? compositionOptionLabel(selectedItemOption, costItems)
                        : 'Item'
                    }
                    onValueChange={(value) => updateComponent(component.key, { costItemId: value })}
                    selectedValue={costItemId}
                  />
                  {hasMissingItem ? (
                    <Text style={[styles.validationText, { color: theme.colors.danger }]}>
                      Selecione um item de custo.
                    </Text>
                  ) : null}
                  {hasDuplicateItem ? (
                    <Text style={[styles.validationText, { color: theme.colors.danger }]}>
                      Este item aparece mais de uma vez.
                    </Text>
                  ) : null}
                  <RetailCatalogLabeledTextField
                    accessibilityLabel={`Quantidade de ${selectedItem?.name ?? 'componente'}`}
                    disabled={disabled}
                    keyboardType="decimal-pad"
                    label={`Quantidade${selectedItem ? ` (${selectedItem.unit})` : ''}`}
                    onChangeText={(value) => updateComponent(component.key, { quantity: value })}
                    placeholder="Ex.: 1"
                    value={component.quantity}
                  />
                  <NativeButton
                    disabled={disabled}
                    haptic="light"
                    label="Remover componente"
                    onPress={() =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              components: current.components.filter(
                                (candidate) => candidate.key !== component.key,
                              ),
                            }
                          : current,
                      )
                    }
                    variant="surface"
                  />
                </PremiumCard>
              );
            })}
          </View>
          <NativeButton
            disabled={disabled || !costItems.some((item) => item.active)}
            haptic="light"
            label="Adicionar componente"
            onPress={addComponent}
            variant="surface"
          />
        </PremiumSection>
        {error ? <InlineError message={error} /> : null}
        <NativeButton
          controlSize="large"
          disabled={disabled}
          haptic="light"
          label="Salvar composição"
          onPress={() => void save()}
          variant="primary"
        />
      </PremiumScreen>
      <ConfirmationDialog
        cancelLabel="Continuar editando"
        confirmLabel="Descartar"
        message="As alterações não salvas serão perdidas."
        onCancel={() => {
          pendingRemoveActionRef.current = null;
          setShowDiscardDialog(false);
        }}
        onConfirm={() => {
          setShowDiscardDialog(false);
          setAllowNextRemove(true);
        }}
        title="Descartar alterações?"
        visible={showDiscardDialog}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14, width: '100%' },
  componentList: { gap: 12 },
  content: { flexGrow: 1, gap: 18 },
  dateRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  validationText: { fontSize: 13 },
});
