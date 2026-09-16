import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { NativeButton } from '@/components/native/NativeButton';
import { NativeSheet } from '@/components/native/NativeSheet';
import { NativeTextField } from '@/components/native/NativeTextField';
import { useAppTheme } from '@/theme';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type {
  NativeRetailCategoryFormSheetProps,
  NativeRetailCategoryFormValues,
} from './NativeRetailCategoryFormSheet.types';

const EMPTY_VALUES: NativeRetailCategoryFormValues = { label: '' };

export default function NativeRetailCategoryFormSheetFallback({
  initialValues,
  mode = 'create',
  onSubmit,
  onVisibleChange,
  title,
  visible,
}: NativeRetailCategoryFormSheetProps) {
  const { theme } = useAppTheme();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const [values, setValues] = useState<NativeRetailCategoryFormValues>(EMPTY_VALUES);
  const [error, setError] = useState<string>();

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible) {
      setValues({ ...EMPTY_VALUES, ...initialValues });
      setError(undefined);
    }
  }, [initialValues, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const submit = async () => {
    if (testModeEnabled) return;
    if (!values.label.trim()) {
      setError('Informe o nome da categoria.');
      return;
    }
    setError(undefined);
    Keyboard.dismiss();
    try {
      await onSubmit(values);
      onVisibleChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível salvar.');
    }
  };

  return (
    <NativeSheet
      onVisibleChange={onVisibleChange}
      title={title ?? (mode === 'edit' ? 'Editar categoria' : 'Nova categoria')}
      visible={visible}
    >
      <View style={[styles.content, { gap: theme.spacing.md }]}>
        <NativeTextField
          accessibilityLabel="Nome da categoria"
          disabled={testModeEnabled}
          label="Nome"
          onChangeText={(label) => setValues({ label })}
          placeholder="Ex.: Cestas"
          value={values.label}
        />
        {error ? (
          <Text style={[theme.typography.footnote, { color: theme.colors.danger }]}>{error}</Text>
        ) : null}
        <NativeButton
          controlSize="large"
          disabled={testModeEnabled}
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
