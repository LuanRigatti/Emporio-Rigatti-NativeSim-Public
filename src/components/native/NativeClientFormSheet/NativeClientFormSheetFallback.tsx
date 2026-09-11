import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { NativeButton } from '@/components/native/NativeButton';
import { NativeSheet } from '@/components/native/NativeSheet';
import { useAppTheme } from '@/theme';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type {
  NativeClientFormSheetProps,
  NativeClientFormValues,
} from './NativeClientFormSheet.types';

export default function NativeClientFormSheetFallback({
  onSubmit,
  onVisibleChange,
  title = 'Adicionar cliente',
  visible,
}: NativeClientFormSheetProps) {
  const { theme } = useAppTheme();
  const { enabled: testModeEnabled, input: maskInput } = useTestModePresentation();
  const [values, setValues] = useState<NativeClientFormValues>({
    address: '',
    bucketPrice: '',
    name: '',
    usesBoleto: false,
    usesInvoice: false,
  });
  const [error, setError] = useState<string>();

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!visible) {
      setValues({ address: '', bucketPrice: '', name: '', usesBoleto: false, usesInvoice: false });
      setError(undefined);
    }
  }, [visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const update = (key: 'name' | 'address' | 'bucketPrice', value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (testModeEnabled) return;
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
    <NativeSheet onVisibleChange={onVisibleChange} title={title} visible={visible}>
      <View style={[styles.content, { gap: theme.spacing.md }]}>
        {(['name', 'address', 'bucketPrice'] as const).map((key) => (
          <View key={key} style={{ gap: theme.spacing.xs }}>
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              {key === 'name' ? 'Nome' : key === 'address' ? 'Endereço' : 'Valor do balde'}
            </Text>
            <TextInput
              keyboardType={key === 'bucketPrice' ? 'decimal-pad' : 'default'}
              editable={!testModeEnabled}
              onChangeText={(value) => update(key, value)}
              placeholder={key === 'bucketPrice' ? 'R$ 0,00' : undefined}
              style={[styles.input, { color: theme.colors.textPrimary }]}
              value={key === 'bucketPrice' ? maskInput(values[key]) : values[key]}
            />
          </View>
        ))}
        <View style={styles.toggleRow}>
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Usa nota fiscal
          </Text>
            <Switch
            disabled={testModeEnabled}
            onValueChange={(usesInvoice) =>
              setValues((current) => ({ ...current, usesInvoice }))
            }
            value={values.usesInvoice}
          />
        </View>
        <View style={styles.toggleRow}>
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>Usa boleto</Text>
          <Switch
            disabled={testModeEnabled}
            onValueChange={(usesBoleto) =>
              setValues((current) => ({ ...current, usesBoleto }))
            }
            value={values.usesBoleto}
          />
        </View>
        {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}
        <NativeButton
          controlSize="large"
          disabled={testModeEnabled}
          haptic="light"
          label="Adicionar"
          onPress={() => void submit()}
          variant="primary"
        />
      </View>
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 12 },
  input: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  toggleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
