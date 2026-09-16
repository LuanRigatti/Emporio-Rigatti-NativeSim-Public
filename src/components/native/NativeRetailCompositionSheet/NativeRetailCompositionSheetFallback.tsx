import { useEffect, useRef, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NativeButton } from '@/components/native/NativeButton';
import { NativeDatePicker } from '@/components/native/NativeDatePicker';
import NativeDropdown from '@/components/native/NativeDropdown';
import { NativeSheet } from '@/components/native/NativeSheet';
import { NativeTextField } from '@/components/native/NativeTextField';
import { useAppTheme } from '@/theme';
import { parseIsoCalendarDate, todayIso } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type {
  NativeRetailCompositionComponentValues,
  NativeRetailCompositionFormValues,
  NativeRetailCompositionSheetProps,
} from './NativeRetailCompositionSheet.types';

const EMPTY_VALUES: NativeRetailCompositionFormValues = {
  components: [],
  effectiveFrom: todayIso(),
};

function withKeys(
  components: readonly NativeRetailCompositionComponentValues[] | undefined,
): NativeRetailCompositionComponentValues[] {
  return (components ?? []).map((component, index) => ({
    key: component.key || `component-${index}`,
    costItemId: component.costItemId,
    quantity: component.quantity,
  }));
}

export default function NativeRetailCompositionSheetFallback({
  costItems,
  initialValues,
  onSubmit,
  onVisibleChange,
  visible,
}: NativeRetailCompositionSheetProps) {
  const { theme } = useAppTheme();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const nextKey = useRef(0);
  const [values, setValues] = useState<NativeRetailCompositionFormValues>(EMPTY_VALUES);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible) {
      setValues({
        ...EMPTY_VALUES,
        ...initialValues,
        components: withKeys(initialValues?.components),
        effectiveFrom: initialValues?.effectiveFrom ?? todayIso(),
      });
      setError(undefined);
      nextKey.current = 0;
      setSubmitting(false);
    }
  }, [initialValues, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const updateComponent = (key: string, patch: Partial<NativeRetailCompositionComponentValues>) =>
    setValues((current) => ({
      ...current,
      components: current.components.map((component) =>
        component.key === key ? { ...component, ...patch } : component,
      ),
    }));

  const addComponent = () => {
    const selected = new Set(values.components.map((component) => component.costItemId));
    const nextItem = costItems.find((item) => !selected.has(item.costItemId));
    if (!nextItem) {
      setError(
        costItems.length
          ? 'Cada item de custo só pode aparecer uma vez.'
          : 'Cadastre itens de custo antes de criar a composição.',
      );
      return;
    }
    setError(undefined);
    setValues((current) => ({
      ...current,
      components: [
        ...current.components,
        { key: `component-${nextKey.current++}`, costItemId: nextItem.costItemId, quantity: '1' },
      ],
    }));
  };

  const submit = async () => {
    if (testModeEnabled || submitting) return;
    if (!values.components.length) {
      setError('Adicione ao menos um componente à composição.');
      return;
    }
    if (
      values.components.some((component) => !component.costItemId || !component.quantity.trim())
    ) {
      setError('Informe o item e a quantidade de cada componente.');
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
    <NativeSheet onVisibleChange={onVisibleChange} title="Nova composição" visible={visible}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.dateRow}>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>Vigência</Text>
          <NativeDatePicker
            accessibilityLabel="Início da composição"
            mode="date"
            onChange={(date) =>
              setValues((current) => ({ ...current, effectiveFrom: todayIso(date) }))
            }
            style="compact"
            value={parseIsoCalendarDate(values.effectiveFrom) ?? new Date()}
          />
        </View>
        {values.components.map((component) => {
          const item = costItems.find((candidate) => candidate.costItemId === component.costItemId);
          return (
            <View key={component.key} style={styles.componentRow}>
              <NativeDropdown
                accessibilityLabel="Item do componente"
                disabled={testModeEnabled || submitting || !costItems.length}
                items={costItems.map((costItem) => ({
                  label: `${costItem.label} (${costItem.unit})`,
                  value: costItem.costItemId,
                }))}
                label="Item"
                onValueChange={(costItemId) => updateComponent(component.key, { costItemId })}
                selectedValue={component.costItemId}
              />
              <NativeTextField
                accessibilityLabel={`Quantidade de ${item?.label ?? 'componente'}`}
                disabled={testModeEnabled || submitting}
                keyboardType="decimal-pad"
                label={`Quantidade${item ? ` (${item.unit})` : ''}`}
                onChangeText={(quantity) => updateComponent(component.key, { quantity })}
                placeholder="Ex.: 1"
                value={component.quantity}
              />
              <NativeButton
                disabled={testModeEnabled || submitting}
                haptic="light"
                label="Remover"
                onPress={() =>
                  setValues((current) => ({
                    ...current,
                    components: current.components.filter(
                      (candidate) => candidate.key !== component.key,
                    ),
                  }))
                }
                variant="surface"
              />
            </View>
          );
        })}
        <NativeButton
          disabled={testModeEnabled || submitting || !costItems.length}
          haptic="light"
          label="Adicionar componente"
          onPress={addComponent}
          variant="surface"
        />
        {error ? (
          <Text style={[theme.typography.footnote, { color: theme.colors.danger }]}>{error}</Text>
        ) : null}
        <NativeButton
          controlSize="large"
          disabled={testModeEnabled || submitting}
          haptic="light"
          label="Salvar composição"
          onPress={() => void submit()}
          variant="primary"
        />
      </ScrollView>
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingVertical: 12 },
  componentRow: { gap: 10 },
  dateRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
