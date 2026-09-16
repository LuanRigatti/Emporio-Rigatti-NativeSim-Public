import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { NativeButton } from '@/components/native/NativeButton';
import NativeDropdown from '@/components/native/NativeDropdown';
import { NativeSheet } from '@/components/native/NativeSheet';
import { useAppTheme } from '@/theme';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type {
  NativeRetailProductCostFormValues,
  NativeRetailProductCostSheetProps,
} from './NativeRetailProductCostSheet.types';

const EMPTY_VALUES: NativeRetailProductCostFormValues = { costMode: '', directCostItemId: '' };

export default function NativeRetailProductCostSheetFallback({
  costItems,
  initialValues,
  onOpenComposition,
  onSubmit,
  onVisibleChange,
  visible,
}: NativeRetailProductCostSheetProps) {
  const { theme } = useAppTheme();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const [values, setValues] = useState<NativeRetailProductCostFormValues>(EMPTY_VALUES);
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

  const submit = async () => {
    if (testModeEnabled || submitting) return;
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
    <NativeSheet onVisibleChange={onVisibleChange} title="Configurar custo" visible={visible}>
      <View style={[styles.content, { gap: theme.spacing.md }]}>
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
              costMode: costMode as NativeRetailProductCostFormValues['costMode'],
              directCostItemId: costMode === 'direct' ? current.directCostItemId : '',
            }))
          }
          selectedValue={values.costMode}
        />
        {values.costMode === 'direct' ? (
          <NativeDropdown
            accessibilityLabel="Item de custo direto"
            disabled={testModeEnabled || submitting || !costItems.length}
            items={costItems.map((item) => ({
              label: `${item.label} (${item.unit})`,
              value: item.costItemId,
            }))}
            label="Item de custo"
            onValueChange={(directCostItemId) =>
              setValues((current) => ({ ...current, directCostItemId }))
            }
            selectedValue={values.directCostItemId}
          />
        ) : null}
        {values.costMode === 'composition' && onOpenComposition ? (
          <NativeButton
            disabled={testModeEnabled || submitting || !costItems.length}
            haptic="light"
            label="Editar composição"
            onPress={onOpenComposition}
            variant="surface"
          />
        ) : null}
        {values.costMode === 'composition' && !costItems.length ? (
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Cadastre itens de custo antes de criar uma composição.
          </Text>
        ) : null}
        {error ? (
          <Text style={[theme.typography.footnote, { color: theme.colors.danger }]}>{error}</Text>
        ) : null}
        <NativeButton
          controlSize="large"
          disabled={testModeEnabled || submitting}
          haptic="light"
          label="Salvar"
          onPress={() => void submit()}
          variant="primary"
        />
      </View>
    </NativeSheet>
  );
}

const styles = StyleSheet.create({ content: { paddingVertical: 12 } });
