import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

export type SearchBarProps = TextInputProps;

export function SearchBar({ style, ...props }: SearchBarProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon} accessibilityElementsHidden>
        ⌕
      </Text>
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? 'Buscar'}
        placeholder={props.placeholder ?? 'Buscar'}
        placeholderTextColor={colors.text.tertiary}
        returnKeyType="search"
        style={[styles.input, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.background.muted,
    paddingHorizontal: spacing.sm,
  },
  icon: {
    color: colors.text.tertiary,
    fontSize: 24,
    marginRight: spacing.xs,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    ...typography.body,
    paddingVertical: 0,
  },
});
