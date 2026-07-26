import { Text, TextInput, View } from 'react-native';

import { useAppTheme } from '@/theme';
import type { NativeDatePickerProps } from '@/types/native-ui';

export default function NativeDatePickerWeb({
  accessibilityLabel,
  mode,
  onChange,
  value,
}: NativeDatePickerProps) {
  const { theme } = useAppTheme();
  const textValue =
    mode === 'date' ? value.toISOString().slice(0, 10) : value.toISOString().slice(11, 16);

  return (
    <View>
      <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
        {mode === 'date' ? 'Data' : 'Hora'}
      </Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        keyboardType="numbers-and-punctuation"
        onChangeText={(nextValue) => {
          const parsed =
            mode === 'date'
              ? new Date(`${nextValue}T12:00:00`)
              : new Date(`1970-01-01T${nextValue}:00`);
          if (!Number.isNaN(parsed.getTime())) {
            onChange(parsed);
          }
        }}
        style={{
          borderColor: theme.colors.separator,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          color: theme.colors.textPrimary,
          padding: theme.spacing.md,
        }}
        value={textValue}
      />
    </View>
  );
}
