import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

import {
  NATIVE_MODE_OPTIONS,
  type NativeModeSheetContentProps,
} from './NativeModeSheetContent.types';

export default function NativeModeSheetContent({ mode, onSelect }: NativeModeSheetContentProps) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.content}>
      <Text style={[theme.typography.title2, { color: theme.colors.textPrimary }]}>
        Modo de venda
      </Text>
      {NATIVE_MODE_OPTIONS.map((option) => {
        const selected = option.mode === mode;

        return (
          <Pressable
            accessibilityLabel={`${option.title}: ${option.description}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={option.mode}
            onPress={() => onSelect(option.mode)}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: pressed || selected ? theme.colors.surfaceMuted : 'transparent',
              },
            ]}
          >
            <View style={styles.optionContent}>
              <View style={styles.optionText}>
                <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                  {option.title}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {option.description}
                </Text>
              </View>
              {selected ? (
                <Text
                  accessibilityLabel="Selecionado"
                  style={[styles.checkmark, { color: theme.colors.textPrimary }]}
                >
                  ✓
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 4 },
  option: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  optionContent: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  optionText: { flex: 1, gap: 2 },
  checkmark: { fontSize: 22, fontWeight: '600' },
});
