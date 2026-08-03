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
    initialValues ?? { estar: '', other: '' },
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible) setValues(initialValues ?? { estar: '', other: '' });
  }, [initialValues, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const update = (field: keyof NativeDailyDataValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  return (
    <NativeSheet
      onVisibleChange={onVisibleChange}
      title="Adicionar dados diários"
      visible={visible}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            Adicionar dados diários
          </Text>
          <Pressable accessibilityLabel="Fechar" onPress={() => onVisibleChange(false)}>
            <Text style={[theme.typography.title2, { color: theme.colors.textPrimary }]}>×</Text>
          </Pressable>
        </View>
        {(['estar', 'other'] as const).map((field) => (
          <View key={field} style={styles.row}>
            <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
              {field === 'estar' ? 'Estar' : 'Outros'}
            </Text>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={(value) => update(field, value)}
              placeholder="R$ 0,00"
              placeholderTextColor={theme.colors.textTertiary}
              style={[
                styles.input,
                theme.typography.body,
                { backgroundColor: theme.colors.surface, color: theme.colors.textPrimary },
              ]}
              value={values[field]}
            />
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
  input: {
    borderRadius: 12,
    minWidth: 132,
    paddingHorizontal: 12,
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
