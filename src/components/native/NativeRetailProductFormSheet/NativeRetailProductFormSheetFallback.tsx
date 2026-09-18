import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { NativeButton } from '@/components/native/NativeButton';
import NativeDropdown from '@/components/native/NativeDropdown';
import { NativeSheet } from '@/components/native/NativeSheet';
import { NativeTextField } from '@/components/native/NativeTextField';
import { useAppTheme } from '@/theme';
import { formatCurrency, formatPtBrDate, normalizeMoney } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type {
  NativeRetailProductCurrentCost,
  NativeRetailProductFormSheetProps,
  NativeRetailProductFormValues,
} from './NativeRetailProductFormSheet.types';
import {
  retailProductCostConfigurationKey,
  retailProductFormInitializationKey,
} from './retailProductFormState';

const EMPTY_VALUES: NativeRetailProductFormValues = {
  categoryId: '',
  costMode: '',
  directCostItemId: '',
  flavor: '',
  packageSize: '',
  productName: '',
  skuCode: '',
  standardSalePrice: '',
  variant: '',
};

export default function NativeRetailProductFormSheetFallback({
  categories,
  costItems = [],
  currentCost,
  initialValues,
  mode = 'create',
  onOpenComposition,
  onSubmit,
  onVisibleChange,
  title,
  visible,
}: NativeRetailProductFormSheetProps) {
  const { theme } = useAppTheme();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const [values, setValues] = useState<NativeRetailProductFormValues>(EMPTY_VALUES);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const initializationKey = retailProductFormInitializationKey(
    initialValues,
    categories,
    costItems,
  );
  const [initializedKey, setInitializedKey] = useState<string>();
  const costConfigurationInitialized =
    initializedKey !== undefined && initializedKey === initializationKey;
  const summaryCostMode = costConfigurationInitialized
    ? values.costMode
    : (initialValues?.costMode ?? values.costMode);
  const costConfigurationDirty =
    costConfigurationInitialized &&
    retailProductCostConfigurationKey(initialValues) !== retailProductCostConfigurationKey(values);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!visible) {
      if (initializedKey !== undefined) setInitializedKey(undefined);
      return;
    }
    if (initializedKey !== initializationKey) {
      setInitializedKey(initializationKey);
      setValues({
        ...EMPTY_VALUES,
        ...initialValues,
        categoryId: initialValues?.categoryId ?? categories[0]?.categoryId ?? '',
      });
      setError(undefined);
      setSubmitting(false);
    }
  }, [categories, costItems, initialValues, initializedKey, initializationKey, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const update = (key: keyof NativeRetailProductFormValues, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (testModeEnabled || submitting) return;
    if (!values.categoryId) {
      setError('Selecione uma categoria.');
      return;
    }
    if (!values.productName.trim()) {
      setError('Informe o nome do produto.');
      return;
    }
    if (
      !values.standardSalePrice.trim() ||
      normalizeMoney(values.standardSalePrice) === undefined
    ) {
      setError('Informe um preço de venda válido.');
      return;
    }
    if (values.costMode === 'direct' && !values.directCostItemId) {
      setError('Selecione o item de custo direto.');
      return;
    }
    setError(undefined);
    setSubmitting(true);
    Keyboard.dismiss();
    try {
      await onSubmit(values);
      onVisibleChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível salvar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NativeSheet
      onVisibleChange={onVisibleChange}
      title={title ?? (mode === 'edit' ? 'Editar produto' : 'Novo produto')}
      visible={visible}
    >
      <View style={[styles.content, { gap: theme.spacing.md }]}>
        <NativeDropdown
          accessibilityLabel="Categoria"
          disabled={testModeEnabled || submitting || !categories.length}
          items={categories.map((category) => ({
            label: category.label,
            value: category.categoryId,
          }))}
          label="Categoria"
          onValueChange={(categoryId) => update('categoryId', categoryId)}
          selectedValue={values.categoryId}
        />
        <NativeTextField
          accessibilityLabel="Nome do produto"
          disabled={testModeEnabled || submitting}
          label="Nome do produto"
          onChangeText={(value) => update('productName', value)}
          placeholder="Ex.: Cesta Café Portugal"
          value={values.productName}
        />
        <NativeTextField
          accessibilityLabel="Variante ou modelo"
          disabled={testModeEnabled || submitting}
          label="Variante/modelo (opcional)"
          onChangeText={(value) => update('variant', value)}
          placeholder="Ex.: Tradicional"
          value={values.variant}
        />
        <NativeTextField
          accessibilityLabel="Sabor"
          disabled={testModeEnabled || submitting}
          label="Sabor (opcional)"
          onChangeText={(value) => update('flavor', value)}
          placeholder="Ex.: Frango"
          value={values.flavor}
        />
        <NativeTextField
          accessibilityLabel="Tamanho da embalagem"
          disabled={testModeEnabled || submitting}
          label="Tamanho/embalagem (opcional)"
          onChangeText={(value) => update('packageSize', value)}
          placeholder="Ex.: 10 unidades"
          value={values.packageSize}
        />
        <NativeTextField
          accessibilityLabel="Preço de venda"
          disabled={testModeEnabled || submitting}
          keyboardType="decimal-pad"
          label="Preço de venda"
          onChangeText={(value) => update('standardSalePrice', value)}
          placeholder="R$ 0,00"
          value={values.standardSalePrice}
        />
        <NativeTextField
          accessibilityLabel="SKU"
          disabled={testModeEnabled || submitting}
          label="SKU (opcional)"
          onChangeText={(value) => update('skuCode', value)}
          placeholder="Código comercial"
          value={values.skuCode}
        />
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
          Custo do produto
        </Text>
        <NativeDropdown
          accessibilityLabel="Modo de custo"
          disabled={testModeEnabled || submitting}
          items={[
            { label: 'Sem custo configurado', value: '' },
            { label: 'Direto', value: 'direct' },
            { label: 'Composição', value: 'composition' },
          ]}
          label="Modo de custo"
          onValueChange={(costMode) =>
            setValues((current) => ({
              ...current,
              costMode: costMode as NativeRetailProductFormValues['costMode'],
              directCostItemId: costMode === 'direct' ? current.directCostItemId : '',
            }))
          }
          selectedValue={values.costMode}
        />
        {values.costMode === 'direct' ? (
          <>
            <NativeDropdown
              accessibilityLabel="Item de custo direto"
              disabled={testModeEnabled || submitting || !costItems.length}
              items={costItems.map((item) => ({
                label: `${item.label} (${item.unit})`,
                value: item.costItemId,
              }))}
              label="Item de custo"
              onValueChange={(directCostItemId) => update('directCostItemId', directCostItemId)}
              selectedValue={values.directCostItemId}
            />
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              Custo direto usa o histórico do item selecionado em Custos.
            </Text>
            {!costItems.length ? (
              <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                Cadastre um item de custo em Custos antes de vincular o custo direto.
              </Text>
            ) : null}
          </>
        ) : null}
        {values.costMode === 'composition' ? (
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Composição usa os componentes e seus custos históricos.
          </Text>
        ) : null}
        {values.costMode === 'composition' && onOpenComposition && costItems.length ? (
          <NativeButton
            disabled={testModeEnabled || submitting}
            haptic="light"
            label="Editar composição"
            onPress={onOpenComposition}
            variant="surface"
          />
        ) : null}
        {values.costMode === 'composition' && !onOpenComposition && costItems.length ? (
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Salve o produto para criar a composição.
          </Text>
        ) : null}
        {values.costMode === 'composition' && !costItems.length ? (
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Cadastre itens de custo em Custos antes de criar uma composição.
          </Text>
        ) : null}
        {currentCost ? (
          <CurrentCostSummary
            costMode={summaryCostMode}
            currentCost={currentCost}
            isDirty={costConfigurationDirty}
          />
        ) : null}
        {error ? (
          <Text style={[theme.typography.footnote, { color: theme.colors.danger }]}>{error}</Text>
        ) : null}
        <NativeButton
          controlSize="large"
          disabled={testModeEnabled || submitting}
          haptic="light"
          label={mode === 'edit' ? 'Salvar' : 'Adicionar'}
          onPress={() => void submit()}
          variant="primary"
        />
      </View>
    </NativeSheet>
  );
}

function CurrentCostSummary({
  costMode,
  currentCost,
  isDirty,
}: {
  costMode: NativeRetailProductFormValues['costMode'];
  currentCost: NativeRetailProductCurrentCost;
  isDirty: boolean;
}) {
  const { theme } = useAppTheme();
  const matchesCurrentMode = !isDirty && currentCost.mode === costMode;
  const title = costMode === 'composition' ? 'Custo atual da composição' : 'Custo atual';
  const status = matchesCurrentMode ? currentCost.status : 'unavailable';
  const message = matchesCurrentMode
    ? currentCost.message
    : 'Salve as alterações para recalcular o custo atual.';
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
        {title}
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

const styles = StyleSheet.create({ content: { paddingVertical: 12 } });
