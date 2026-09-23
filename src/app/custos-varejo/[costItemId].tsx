import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeRetailCostEntryFormSheet,
  NativeRetailCostItemFormSheet,
  type NativeRetailCostEntryFormValues,
  type NativeRetailCostItemFormValues,
} from '@/components/native';
import { EmptyState, ErrorState, Loading, PremiumCard, PremiumScreen } from '@/components/premium';
import { useRetailCostEntries } from '@/hooks/useRetailCostEntries';
import { useRetailCostItems } from '@/hooks/useRetailCostItems';
import { useAppMode } from '@/providers';
import { normalizeRetailMoney, normalizeRetailQuantity } from '@/services/retail-costs';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import type { RetailCostEntry, RetailCostItem } from '@/types/data';
import { formatCurrency, formatPtBrDate } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

function itemFormValues(item?: RetailCostItem): Partial<NativeRetailCostItemFormValues> {
  return item ? { name: item.name, supplier: item.supplier ?? '', unit: item.unit } : {};
}

function entryFormValues(entry?: RetailCostEntry): Partial<NativeRetailCostEntryFormValues> {
  return entry
    ? {
        effectiveDate: entry.effectiveDate,
        purchaseTotalCost: String(entry.purchaseTotalCost),
        purchasedQuantity: String(entry.purchasedQuantity),
        supplier: entry.supplier ?? '',
      }
    : {};
}

export default function RetailCostItemDetailsRoute() {
  const { mode } = useAppMode();
  const { theme, resolvedMode } = useAppTheme();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const { costItemId } = useLocalSearchParams<{ costItemId?: string }>();
  const {
    error: itemError,
    items,
    loading: itemLoading,
    reload: reloadItems,
    update,
  } = useRetailCostItems({ includeInactive: true });
  const {
    create,
    entries,
    error: entriesError,
    loading: entriesLoading,
    reload: reloadEntries,
    updateEffectiveDate,
  } = useRetailCostEntries(costItemId);
  const [entryFormVisible, setEntryFormVisible] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<RetailCostEntry | null>(null);
  const [itemFormVisible, setItemFormVisible] = useState(false);
  const item = useMemo(
    () => items.find((candidate) => candidate.costItemId === costItemId),
    [costItemId, items],
  );
  const entryInitialValues = useMemo(
    () => entryFormValues(entryToEdit ?? undefined),
    [entryToEdit],
  );

  const handleEntrySubmit = useCallback(
    async (values: NativeRetailCostEntryFormValues) => {
      if (!item || testModeEnabled) return;
      if (entryToEdit) {
        await updateEffectiveDate(entryToEdit.entryId, values.effectiveDate);
        return;
      }
      const purchasedQuantity = normalizeRetailQuantity(
        values.purchasedQuantity,
        'A quantidade comprada',
      );
      const purchaseTotalCost = normalizeRetailMoney(
        values.purchaseTotalCost,
        'O custo total da compra',
      );
      await create(item.unit, {
        effectiveDate: values.effectiveDate,
        purchaseTotalCost,
        purchasedQuantity,
        supplier: values.supplier,
      });
    },
    [create, entryToEdit, item, testModeEnabled, updateEffectiveDate],
  );

  const handleEntryVisibleChange = useCallback((visible: boolean) => {
    setEntryFormVisible(visible);
    if (!visible) setEntryToEdit(null);
  }, []);

  const handleItemSubmit = useCallback(
    async (values: NativeRetailCostItemFormValues) => {
      if (!item || testModeEnabled) return;
      await update(item.costItemId, {
        name: values.name,
        supplier: values.supplier,
        unit: values.unit,
      });
    },
    [item, testModeEnabled, update],
  );

  const cardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const cardRadius = theme.radius.xl + theme.spacing.sm;

  return (
    <>
      {mode === 'retail' && item ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel="Editar item de custo"
            icon="pencil"
            onPress={() => setItemFormVisible(true)}
          />
          <Stack.Toolbar.Button
            accessibilityLabel="Adicionar entrada de custo"
            icon="plus"
            onPress={() => {
              setEntryToEdit(null);
              setEntryFormVisible(true);
            }}
          />
        </Stack.Toolbar>
      ) : null}
      <PremiumScreen
        contentContainerStyle={[styles.content, { backgroundColor: theme.colors.background }]}
        overlayHeader={<NativeGlassHeader mode="transparent" title="Histórico de custos" />}
        progressiveBlur
      >
        {mode !== 'retail' ? (
          <EmptyState
            description="Alterne para Varejo para acessar custos históricos."
            title="Custos Varejo"
          />
        ) : itemLoading || entriesLoading ? (
          <Loading label="Carregando histórico de custos" />
        ) : itemError || entriesError ? (
          <ErrorState
            description={itemError ?? entriesError}
            onRetry={() => {
              void reloadItems();
              void reloadEntries();
            }}
            title="Não foi possível carregar"
          />
        ) : !item ? (
          <EmptyState title="Item de custo não encontrado" />
        ) : (
          <View style={{ gap: theme.spacing.lg, marginTop: theme.spacing.xl }}>
            <PremiumCard
              style={[styles.card, { backgroundColor: cardSurface, borderRadius: cardRadius }]}
            >
              <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
                {item.name}
              </Text>
              <DetailRow label="Unidade-base" value={item.unit} />
              <DetailRow label="Fornecedor" value={item.supplier ?? 'Não informado'} />
              <DetailRow label="Status" value={item.active ? 'Ativo' : 'Desativado'} />
            </PremiumCard>
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
              Entradas
            </Text>
            <PremiumCard
              style={[styles.card, { backgroundColor: cardSurface, borderRadius: cardRadius }]}
            >
              {entries.length ? (
                entries.map((entry) => (
                  <Pressable
                    accessibilityLabel={`Editar vigência do custo em ${formatPtBrDate(entry.effectiveDate)}`}
                    accessibilityRole="button"
                    key={entry.entryId}
                    onPress={() => {
                      setEntryToEdit(entry);
                      setEntryFormVisible(true);
                    }}
                    style={({ pressed }) => [styles.entry, pressed && styles.entryPressed]}
                  >
                    <View style={styles.entryHeading}>
                      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                        Vigente desde {formatPtBrDate(entry.effectiveDate)}
                      </Text>
                      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                        {formatCurrency(entry.purchaseTotalCost)}
                      </Text>
                    </View>
                    <DetailRow
                      label={`Quantidade (${entry.unit})`}
                      value={String(entry.purchasedQuantity)}
                    />
                    <DetailRow
                      label="Custo unitário"
                      value={formatCurrency(entry.normalizedUnitCost)}
                    />
                    {entry.supplier ? (
                      <DetailRow label="Fornecedor" value={entry.supplier} />
                    ) : null}
                  </Pressable>
                ))
              ) : (
                <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                  Nenhuma entrada registrada.
                </Text>
              )}
            </PremiumCard>
          </View>
        )}
      </PremiumScreen>
      {item ? (
        <NativeRetailCostItemFormSheet
          initialValues={itemFormValues(item)}
          mode="edit"
          onSubmit={handleItemSubmit}
          onVisibleChange={setItemFormVisible}
          visible={itemFormVisible}
        />
      ) : null}
      {item ? (
        <NativeRetailCostEntryFormSheet
          initialValues={entryInitialValues}
          itemUnit={item.unit}
          mode={entryToEdit ? 'edit' : 'create'}
          onSubmit={handleEntrySubmit}
          onVisibleChange={handleEntryVisibleChange}
          title={entryToEdit ? 'Editar vigência do custo' : 'Nova entrada de custo'}
          visible={entryFormVisible}
        />
      ) : null}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14, padding: 16 },
  content: { flexGrow: 1 },
  detailRow: { gap: 4 },
  entry: { gap: 6, paddingVertical: 8 },
  entryPressed: { opacity: 0.72 },
  entryHeading: { flexDirection: 'row', justifyContent: 'space-between' },
});
