import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import type { NativePickerProps } from '@/types/native-ui';

export default function NativePickerWeb({
  accessibilityLabel,
  label,
  onSelectedIndexChange,
  options,
  selectedIndex,
}: NativePickerProps) {
  const { theme } = useAppTheme();
  const [selectedLabel, setSelectedLabel] = useState(
    selectedIndex === null ? 'Selecionar' : (options[selectedIndex] ?? 'Selecionar'),
  );

  return (
    <View>
      {label ? (
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          {label}
        </Text>
      ) : null}
      <Pressable
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        onPress={() => {
          const nextIndex = selectedIndex === null ? 0 : (selectedIndex + 1) % options.length;
          setSelectedLabel(options[nextIndex] ?? 'Selecionar');
          onSelectedIndexChange(nextIndex);
        }}
        style={({ pressed }) => [
          styles.control,
          {
            backgroundColor: pressed ? theme.colors.backgroundSecondary : theme.colors.surface,
            borderColor: theme.colors.separator,
            borderRadius: theme.radius.md,
            marginTop: theme.spacing.xs,
            padding: theme.spacing.md,
          },
        ]}
      >
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
          {selectedLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({ control: { borderWidth: 1 } });
