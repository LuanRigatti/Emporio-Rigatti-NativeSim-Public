import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { NativeButton } from '@/components/native/NativeButton';
import NativeDropdown from '@/components/native/NativeDropdown';
import { NativeSheet } from '@/components/native/NativeSheet';
import { NativeTextField } from '@/components/native/NativeTextField';
import { useAppTheme } from '@/theme';
import { normalizeMoney } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type {
  NativeRetailProductFormSheetProps,
  NativeRetailProductFormValues,
} from './NativeRetailProductFormSheet.types';

const EMPTY_VALUES: NativeRetailProductFormValues = {
  categoryId: '',
  flavor: '',
  packageSize: '',
  productName: '',
  skuCode: '',
  standardSalePrice: '',
  variant: '',
};

export default function NativeRetailProductFormSheetFallback({
  categories,
  initialValues,
  mode = 'create',
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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible) {
      setValues({
        ...EMPTY_VALUES,
        ...initialValues,
        categoryId: initialValues?.categoryId ?? categories[0]?.categoryId ?? '',
      });
      setError(undefined);
      setSubmitting(false);
    }
  }, [categories, initialValues, visible]);
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

const styles = StyleSheet.create({ content: { paddingVertical: 12 } });
