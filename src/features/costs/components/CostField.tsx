import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { NativeTextField } from '@/components/native';
import { useAppTheme } from '@/theme';

export type CostFieldProps = {
  disabled?: boolean;
  keyboardType?: React.ComponentProps<typeof NativeTextField>['keyboardType'];
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  trailing?: ReactNode;
  value: string;
};

export function CostField({ disabled, label, trailing, ...props }: CostFieldProps) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          {label}
        </Text>
        {trailing}
      </View>
      <NativeTextField accessibilityLabel={label} disabled={disabled} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  labelRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
