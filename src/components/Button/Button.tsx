import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { borders, colors, radius, spacing, typography } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary';

export type ButtonProps = Omit<PressableProps, 'children'> & {
  children: ReactNode;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  variant?: ButtonVariant;
};

export function Button({
  children,
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  variant = 'primary',
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        pressed && !isDisabled && (isPrimary ? styles.primaryPressed : styles.secondaryPressed),
        isDisabled && (isPrimary ? styles.primaryDisabled : styles.secondaryDisabled),
        fullWidth && styles.fullWidth,
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.text.inverse : colors.brand.primary} />
      ) : (
        <>
          {leftIcon}
          <Text style={[styles.label, isPrimary ? styles.primaryLabel : styles.secondaryLabel]}>
            {children}
          </Text>
          {rightIcon}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  primary: {
    backgroundColor: colors.brand.primary,
  },
  primaryPressed: {
    backgroundColor: colors.brand.primaryPressed,
  },
  primaryDisabled: {
    backgroundColor: colors.text.disabled,
  },
  secondary: {
    backgroundColor: colors.background.surface,
    borderWidth: borders.width.thin,
    borderStyle: borders.style,
    borderColor: colors.brand.primary,
  },
  secondaryPressed: {
    backgroundColor: colors.feedback.infoSurface,
  },
  secondaryDisabled: {
    borderColor: colors.border.strong,
    backgroundColor: colors.background.muted,
  },
  label: {
    ...typography.bodyEmphasized,
  },
  primaryLabel: {
    color: colors.text.inverse,
  },
  secondaryLabel: {
    color: colors.brand.primary,
  },
});
