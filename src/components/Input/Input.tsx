import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { borders, colors, radius, spacing, typography } from '@/theme';

export type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  helperText?: string;
};

export function Input({ label, error, helperText, style, ...props }: InputProps) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        placeholderTextColor={colors.text.tertiary}
        style={[styles.input, error && styles.inputError, style]}
      />
      {error || helperText ? (
        <Text style={[styles.message, error ? styles.error : styles.helper]}>
          {error ?? helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    ...typography.subheadline,
    color: colors.text.primary,
  },
  input: {
    minHeight: 48,
    borderWidth: borders.width.thin,
    borderStyle: borders.style,
    borderColor: colors.border.strong,
    borderRadius: radius.md,
    backgroundColor: colors.background.surface,
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  inputError: {
    borderColor: colors.feedback.negative,
  },
  message: {
    ...typography.caption,
  },
  error: {
    color: colors.feedback.negative,
  },
  helper: {
    color: colors.text.tertiary,
  },
});
