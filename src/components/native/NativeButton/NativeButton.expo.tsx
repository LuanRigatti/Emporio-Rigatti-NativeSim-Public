import Ionicons from '@expo/vector-icons/Ionicons';
import { GlassButton } from '@/components/premium';
import type { ComponentProps } from 'react';

import type { NativeButtonProps } from '@/types/native-ui';

export default function NativeButtonExpo({
  accessibilityLabel,
  destructive,
  disabled,
  fallbackIcon,
  label,
  onPress,
}: NativeButtonProps) {
  const icon = fallbackIcon as ComponentProps<typeof Ionicons>['name'] | undefined;

  return (
    <GlassButton
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      icon={icon}
      label={label}
      onPress={onPress}
      variant={destructive ? 'destructive' : 'glass'}
    />
  );
}
