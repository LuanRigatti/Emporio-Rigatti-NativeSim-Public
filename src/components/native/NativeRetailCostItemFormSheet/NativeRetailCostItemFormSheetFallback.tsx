import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { NativeButton } from '@/components/native/NativeButton';
import { NativeSheet } from '@/components/native/NativeSheet';
import { NativeTextField } from '@/components/native/NativeTextField';
import { useAppTheme } from '@/theme';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type {
  NativeRetailCostItemFormSheetProps,
  NativeRetailCostItemFormValues,
} from './NativeRetailCostItemFormSheet.types';

const EMPTY_VALUES: NativeRetailCostItemFormValues = { name: '', supplier: '', unit: '' };

export default function NativeRetailCostItemFormSheetFallback({
  initialValues,
  mode = 'create',
  onSubmit,
  onVisibleChange,
  title,
  visible,
}: NativeRetailCostItemFormSheetProps) {
  const { theme } = useAppTheme();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const [values, setValues] = useState<NativeRetailCostItemFormValues>(EMPTY_VALUES);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible) {
      setValues({ ...EMPTY_VALUES, ...initialValues });
      setError(undefined);
      setSubmitting(false);
    }
  }, [initialValues, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const update = (key: keyof NativeRetailCostItemFormValues, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (testModeEnabled || submitting) return;
    if (!values.name.trim()) {
      setError('Informe o nome do item de custo.');
      return;
    }
    if (!values.unit.trim()) {
      setError('Informe a unidade-base do item de custo.');
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
      title={title ?? (mode === 'edit' ? 'Editar item de custo' : 'Novo item de custo')}
      visible={visible}
    >
      <View style={[styles.content, { gap: theme.spacing.md }]}>
        <NativeTextField
          accessibilityLabel="Nome do item de custo"
          disabled={testModeEnabled || submitting}
          label="Nome"
          onChangeText={(value) => update('name', value)}
          placeholder="Ex.: Café"
          value={values.name}
        />
        <NativeTextField
          accessibilityLabel="Unidade-base do item de custo"
          disabled={testModeEnabled || submitting || mode === 'edit'}
          label="Unidade-base"
          onChangeText={(value) => update('unit', value)}
          placeholder="Ex.: unidade, kg, litro"
          value={values.unit}
        />
        <NativeTextField
          accessibilityLabel="Fornecedor do item de custo"
          disabled={testModeEnabled || submitting}
          label="Fornecedor (opcional)"
          onChangeText={(value) => update('supplier', value)}
          placeholder="Opcional"
          value={values.supplier}
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
