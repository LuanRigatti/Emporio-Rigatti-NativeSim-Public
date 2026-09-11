import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import type { NativePickerProps } from '@/types/native-ui';

export default function NativePickerExpo({
  accessibilityLabel,
  label,
  onSelectedIndexChange,
  options,
  selectedIndex,
}: NativePickerProps) {
  const { theme } = useAppTheme();
  const selectedLabel =
    selectedIndex === null ? 'Selecionar' : (options[selectedIndex] ?? 'Selecionar');

  const openPicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...options, 'Cancelar'], cancelButtonIndex: options.length, title: label },
        (index) => {
          if (index < options.length) {
            onSelectedIndexChange(index);
          }
        },
      );
      return;
    }

    Alert.alert(
      label ?? 'Selecionar',
      undefined,
      options.map((option, index) => ({
        text: option,
        onPress: () => onSelectedIndexChange(index),
      })),
    );
  };

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      onPress={openPicker}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed ? theme.colors.backgroundSecondary : theme.colors.surface,
          borderColor: theme.colors.separator,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
        },
      ]}
    >
      {label ? (
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.valueRow, { marginTop: theme.spacing.xs }]}>
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
          {selectedLabel}
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>⌄</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1 },
  valueRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
