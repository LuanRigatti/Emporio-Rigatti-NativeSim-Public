import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { NativeButton } from '@/components/native/NativeButton';
import { NativeSheet } from '@/components/native/NativeSheet';
import { NativeTextField } from '@/components/native/NativeTextField';
import { NativeToggle } from '@/components/native/NativeToggle';
import { useAppTheme } from '@/theme';
import { normalizeMoney } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import {
  EMPTY_RETAIL_CLIENT_FORM_VALUES,
  type NativeRetailClientFormSheetProps,
  type NativeRetailClientFormValues,
} from './NativeRetailClientFormSheet.types';

export default function NativeRetailClientFormSheetFallback({
  initialValues,
  mode = 'create',
  onSubmit,
  onVisibleChange,
  title,
  visible,
}: NativeRetailClientFormSheetProps) {
  const { theme } = useAppTheme();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const [values, setValues] = useState<NativeRetailClientFormValues>(
    EMPTY_RETAIL_CLIENT_FORM_VALUES,
  );
  const [error, setError] = useState<string>();

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible) {
      setValues({ ...EMPTY_RETAIL_CLIENT_FORM_VALUES, ...initialValues });
      setError(undefined);
      return;
    }
    setValues(EMPTY_RETAIL_CLIENT_FORM_VALUES);
    setError(undefined);
  }, [initialValues, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const update = (key: keyof NativeRetailClientFormValues, value: string | boolean) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (testModeEnabled) return;
    if (!values.name.trim()) {
      setError('Informe o nome do cliente.');
      return;
    }
    if (
      values.defaultDeliveryFee.trim() &&
      normalizeMoney(values.defaultDeliveryFee) === undefined
    ) {
      setError('Informe uma taxa de entrega válida.');
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

  const resolvedTitle = title ?? (mode === 'edit' ? 'Editar cliente' : 'Adicionar cliente');

  return (
    <NativeSheet onVisibleChange={onVisibleChange} title={resolvedTitle} visible={visible}>
      <View style={[styles.content, { gap: theme.spacing.md }]}>
        <NativeTextField
          accessibilityLabel="Nome"
          disabled={testModeEnabled}
          label="Nome"
          onChangeText={(value) => update('name', value)}
          placeholder="Nome do cliente"
          value={values.name}
        />
        <NativeTextField
          accessibilityLabel="Telefone"
          disabled={testModeEnabled}
          keyboardType="phone-pad"
          label="Telefone"
          onChangeText={(value) => update('phone', value)}
          placeholder="Telefone (opcional)"
          value={values.phone}
        />
        <NativeTextField
          accessibilityLabel="Endereço"
          disabled={testModeEnabled}
          label="Endereço"
          multiline
          onChangeText={(value) => update('address', value)}
          placeholder="Endereço (opcional)"
          value={values.address}
        />
        <NativeToggle
          disabled={testModeEnabled}
          label="Possui indicação"
          onValueChange={(value) => update('hasReferral', value)}
          value={values.hasReferral}
        />
        {values.hasReferral ? (
          <>
            <NativeTextField
              accessibilityLabel="Tipo ou origem da indicação"
              disabled={testModeEnabled}
              label="Tipo/origem da indicação"
              onChangeText={(value) => update('sourceType', value)}
              placeholder="Ex.: Instagram, amigo"
              value={values.sourceType}
            />
            <NativeTextField
              accessibilityLabel="Quem indicou"
              disabled={testModeEnabled}
              label="Quem indicou"
              onChangeText={(value) => update('referredByName', value)}
              placeholder="Nome (opcional)"
              value={values.referredByName}
            />
          </>
        ) : null}
        <NativeTextField
          accessibilityLabel="Taxa padrão de entrega"
          disabled={testModeEnabled}
          keyboardType="decimal-pad"
          label="Taxa padrão de entrega"
          onChangeText={(value) => update('defaultDeliveryFee', value)}
          placeholder="R$ 0,00 (opcional)"
          value={values.defaultDeliveryFee}
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
