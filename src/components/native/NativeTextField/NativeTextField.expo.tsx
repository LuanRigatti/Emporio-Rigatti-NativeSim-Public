import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useRef } from 'react';

import { useAppTheme } from '@/theme';
import type { NativeTextFieldProps } from '@/types/native-ui';

export default function NativeTextFieldExpo({
  accessibilityLabel,
  disabled,
  keyboardType,
  label,
  multiline,
  onChangeText,
  onBlurReady,
  placeholder,
  secureTextEntry,
  style,
  value,
}: NativeTextFieldProps) {
  const { theme } = useAppTheme();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!onBlurReady) return;
    onBlurReady(() => inputRef.current?.blur());
  }, [onBlurReady]);

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={inputRef}
        accessibilityLabel={accessibilityLabel ?? label}
        editable={!disabled}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textTertiary}
        secureTextEntry={secureTextEntry}
        style={[
          styles.input,
          theme.typography.body,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.separator,
            borderRadius: theme.radius.md,
            color: theme.colors.textPrimary,
            marginTop: theme.spacing.xs,
            opacity: disabled ? theme.opacities.disabled : 1,
            padding: theme.spacing.md,
          },
          style,
        ]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  input: { minHeight: 48 },
});
