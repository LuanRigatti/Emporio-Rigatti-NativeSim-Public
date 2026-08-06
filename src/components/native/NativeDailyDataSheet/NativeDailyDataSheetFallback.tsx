import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useState } from 'react';

import { NativeSheet } from '../NativeSheet';
import { useAppTheme } from '@/theme';
import type {
  NativeDailyDataSheetProps,
  NativeDailyDataValues,
} from './NativeDailyDataSheet.types';

export default function NativeDailyDataSheetFallback({
  initialValues,
  onSubmit,
  onVisibleChange,
  visible,
}: NativeDailyDataSheetProps) {
  const { theme } = useAppTheme();
  const [values, setValues] = useState<NativeDailyDataValues>(
    initialValues ?? { estar: '', fuelPrice: '', kilometers: '', other: '' },
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible)
      setValues(initialValues ?? { estar: '', fuelPrice: '', kilometers: '', other: '' });
  }, [initialValues, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const update = (field: keyof NativeDailyDataValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  return (
    <NativeSheet onVisibleChange={onVisibleChange} title={'Dados Di\u00e1rios'} visible={visible}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            {'Dados Di\u00e1rios'}
          </Text>
          <Pressable accessibilityLabel="Fechar" onPress={() => onVisibleChange(false)}>
            <Text style={[theme.typography.title2, { color: theme.colors.textPrimary }]}>Ã—</Text>
          </Pressable>
        </View>
        {(
          [
            { currency: true, key: 'estar', label: 'Estar' },
            { currency: true, key: 'other', label: 'Outros' },
            { currency: false, key: 'kilometers', label: 'Km' },
            { currency: true, key: 'fuelPrice', label: 'Combust\u00edvel' },
          ] as const
        ).map(({ currency, key, label }) => (
          <View key={key} style={styles.row}>
            <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
              {label}
            </Text>
            <View style={[styles.inputShell, { backgroundColor: theme.colors.surface }]}>
              {currency ? (
                <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>R$</Text>
              ) : null}
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={(value) => update(key, value)}
                placeholder={currency ? '0,00' : '0,0'}
                placeholderTextColor={theme.colors.textTertiary}
                style={[styles.input, theme.typography.body, { color: theme.colors.textPrimary }]}
                value={values[key]}
              />
            </View>
          </View>
        ))}
        <Pressable
          onPress={() => {
            void onSubmit(values);
            onVisibleChange(false);
          }}
          style={[styles.addButton, { backgroundColor: theme.colors.selectionSurface }]}
        >
          <Text style={[theme.typography.body, { color: theme.colors.selectionContent }]}>
            Adicionar
          </Text>
        </Pressable>
      </View>
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  inputShell: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 4,
    minWidth: 132,
    paddingHorizontal: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    textAlign: 'right',
  },
  addButton: {
    alignSelf: 'flex-end',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
});
