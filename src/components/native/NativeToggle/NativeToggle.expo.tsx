import { StyleSheet, Switch, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import type { NativeToggleProps } from '@/types/native-ui';

export default function NativeToggleExpo({
  disabled,
  label,
  onValueChange,
  value,
}: NativeToggleProps) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.row, { minHeight: theme.sizes.touchTargetMinimum }]}>
      {label ? (
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{label}</Text>
      ) : null}
      <Switch
        accessibilityLabel={label}
        disabled={disabled}
        onValueChange={onValueChange}
        thumbColor={theme.colors.surfaceElevated}
        trackColor={{ false: theme.colors.separator, true: theme.colors.primary }}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
