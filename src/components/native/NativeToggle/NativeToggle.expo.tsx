import { Switch } from 'react-native';

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
    <Switch
      accessibilityLabel={label}
      disabled={disabled}
      onValueChange={onValueChange}
      thumbColor={theme.colors.surfaceElevated}
      trackColor={{ false: theme.colors.separator, true: theme.colors.primary }}
      value={value}
    />
  );
}
