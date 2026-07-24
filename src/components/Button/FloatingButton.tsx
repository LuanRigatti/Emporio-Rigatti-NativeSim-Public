import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { colors, shadows } from '@/theme';

export type FloatingButtonProps = Omit<PressableProps, 'children' | 'accessibilityLabel'> & {
  icon: ReactNode;
  accessibilityLabel: string;
  size?: number;
};

export function FloatingButton({
  icon,
  accessibilityLabel,
  size = 56,
  disabled,
  style,
  ...props
}: FloatingButtonProps) {
  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled ?? false }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.elevated,
  },
  pressed: {
    backgroundColor: colors.brand.primaryPressed,
    transform: [{ scale: 0.96 }],
  },
  disabled: {
    backgroundColor: colors.text.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
});
