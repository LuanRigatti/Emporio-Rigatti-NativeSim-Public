import { StyleSheet, Text, View } from 'react-native';

import { NativeTextField } from '@/components/native';
import { useAppTheme } from '@/theme';
import type { NativeTextFieldProps } from '@/types/native-ui';

type RetailCatalogLabeledTextFieldProps = NativeTextFieldProps & {
  label: string;
};

export function RetailCatalogLabeledTextField({
  label,
  ...textFieldProps
}: RetailCatalogLabeledTextFieldProps) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.field, { gap: theme.spacing.xxs }]}>
      <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
      <NativeTextField {...textFieldProps} label={undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { width: '100%' },
});
