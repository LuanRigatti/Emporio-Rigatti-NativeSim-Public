import { StyleSheet, Text, View } from 'react-native';

import { NativeTextField } from '@/components/native';
import { useAppTheme } from '@/theme';

export type CostFieldProps = {
  disabled?: boolean;
  keyboardType?: React.ComponentProps<typeof NativeTextField>['keyboardType'];
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
};

export function CostField({ disabled, label, ...props }: CostFieldProps) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.field}>
      <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
      <NativeTextField accessibilityLabel={label} disabled={disabled} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
});
