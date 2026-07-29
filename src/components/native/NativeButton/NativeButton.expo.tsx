import Ionicons from '@expo/vector-icons/Ionicons';
import { GlassButton } from '@/components/premium';
import type { ComponentProps } from 'react';

import type { NativeButtonProps } from '@/types/native-ui';

export default function NativeButtonExpo({
  accessibilityLabel,
  accessibilityHint,
  content,
  destructive,
  disabled,
  fallbackIcon,
  haptic,
  label,
  onPress,
  variant,
}: NativeButtonProps) {
  const icon = fallbackIcon as ComponentProps<typeof Ionicons>['name'] | undefined;

  return (
    <GlassButton
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      icon={icon}
      haptic={haptic ?? 'none'}
      label={content?.type === 'stacked' ? `${content.title} ${content.subtitle}` : label}
      onPress={onPress}
      variant={
        destructive
          ? 'destructive'
          : variant === 'primary' || variant === 'filled'
            ? 'contrast'
            : variant === 'surface'
              ? 'secondary'
              : 'glass'
      }
    />
  );
}
