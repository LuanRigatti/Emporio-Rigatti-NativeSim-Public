import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { NativeButton } from '@/components/native/NativeButton';
import { NativeDatePicker } from '@/components/native/NativeDatePicker';
import { NativeSheet } from '@/components/native/NativeSheet';
import { NativeTextField } from '@/components/native/NativeTextField';
import { useAppTheme } from '@/theme';
import { parseIsoCalendarDate, todayIso } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type {
  NativeRetailCostEntryFormSheetProps,
  NativeRetailCostEntryFormValues,
} from './NativeRetailEntryFormSheet.types';

const EMPTY_VALUES: NativeRetailCostEntryFormValues = {
  effectiveDate: todayIso(),
  purchaseTotalCost: '',
  purchasedQuantity: '',
  supplier: '',
};

export default function NativeRetailEntryFormSheetFallback({
  initialValues,
  itemUnit,
  onSubmit,
  onVisibleChange,
  mode = 'create',
  title,
  visible,
}: NativeRetailCostEntryFormSheetProps) {
  const { theme } = useAppTheme();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const isEditing = mode === 'edit';
  const [values, setValues] = useState<NativeRetailCostEntryFormValues>(EMPTY_VALUES);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible) {
      setValues({ ...EMPTY_VALUES, effectiveDate: todayIso(), ...initialValues });
      setError(undefined);
      setSubmitting(false);
    }
  }, [initialValues, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const update = (key: keyof NativeRetailCostEntryFormValues, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (testModeEnabled || submitting) return;
    if (!isEditing && !values.purchasedQuantity.trim()) {
      setError('Informe a quantidade comprada.');
      return;
    }
    if (!isEditing && !values.purchaseTotalCost.trim()) {
      setError('Informe o custo total da compra.');
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

  const dateValue = parseIsoCalendarDate(values.effectiveDate) ?? new Date();
  return (
    <NativeSheet
      onVisibleChange={onVisibleChange}
      title={title ?? (isEditing ? 'Editar vigência do custo' : 'Nova entrada de custo')}
      visible={visible}
    >
      <View style={[styles.content, { gap: theme.spacing.md }]}>
        <View style={styles.dateRow}>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
            Vigente desde
          </Text>
          <NativeDatePicker
            accessibilityLabel="Vigente desde do custo"
            mode="date"
            onChange={(date) => update('effectiveDate', todayIso(date))}
            style="compact"
            value={dateValue}
          />
        </View>
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          Unidade: {itemUnit}
        </Text>
        <NativeTextField
          accessibilityLabel="Quantidade comprada"
          disabled={testModeEnabled || submitting || isEditing}
          keyboardType="decimal-pad"
          label={`Quantidade comprada (${itemUnit})`}
          onChangeText={(value) => update('purchasedQuantity', value)}
          placeholder="Ex.: 10"
          value={values.purchasedQuantity}
        />
        <NativeTextField
          accessibilityLabel="Custo total da compra"
          disabled={testModeEnabled || submitting || isEditing}
          keyboardType="decimal-pad"
          label="Custo total da compra"
          onChangeText={(value) => update('purchaseTotalCost', value)}
          placeholder="R$ 0,00"
          value={values.purchaseTotalCost}
        />
        <NativeTextField
          accessibilityLabel="Fornecedor da entrada de custo"
          disabled={testModeEnabled || submitting || isEditing}
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
          label={isEditing ? 'Salvar vigência' : 'Adicionar entrada'}
          onPress={() => void submit()}
          variant="primary"
        />
      </View>
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 12 },
  dateRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
