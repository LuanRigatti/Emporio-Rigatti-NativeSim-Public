import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import type { ButtonSize, CommonAccessibilityProps, ViewComponentStyle } from '../types';

type ButtonProps = CommonAccessibilityProps & {
  children?: ReactNode;
  label?: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  size?: ButtonSize;
  style?: ViewComponentStyle;
};

type ButtonTone = 'primary' | 'secondary' | 'destructive' | 'text';

type ThemedButtonProps = ButtonProps & {
  tone: ButtonTone;
};

function ThemedButton({
  children,
  label,
  onPress,
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  size = 'medium',
  style,
  accessibilityLabel,
  accessibilityHint,
  tone,
}: ThemedButtonProps) {
  const { theme, reduceMotionEnabled } = useAppTheme();
  const { colors, typography, spacing, radius, sizes } = theme;
  const isDisabled = disabled || loading;
  const buttonContent = children ?? label;
  const pressedScale = reduceMotionEnabled
    ? theme.animations.reducedMotion.scale
    : theme.animations.scale.pressed;

  const handlePress = () => {
    triggerLightImpactHaptic();
    onPress?.();
  };

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor:
            tone === 'primary'
              ? pressed
                ? colors.primaryPressed
                : colors.primary
              : tone === 'destructive'
                ? pressed
                  ? colors.danger
                  : colors.dangerSurface
                : tone === 'secondary'
                  ? pressed
                    ? colors.backgroundSecondary
                    : colors.surface
                  : 'transparent',
          borderColor:
            tone === 'secondary'
              ? colors.borderStrong
              : tone === 'destructive'
                ? colors.danger
                : 'transparent',
          borderWidth: tone === 'text' ? 0 : 1,
          borderRadius: radius.md,
          minHeight: sizes.buttonHeight,
          opacity: isDisabled ? theme.opacities.disabled : 1,
          paddingHorizontal: size === 'small' ? spacing.sm : spacing.lg,
          width: fullWidth ? '100%' : undefined,
          transform: [{ scale: pressed && !isDisabled ? pressedScale : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={tone === 'primary' ? colors.textInverse : colors.primary}
          size="small"
        />
      ) : (
        <View style={[styles.content, { gap: spacing.xs }]}>
          {icon}
          <Text
            style={[
              size === 'small' ? typography.subheadline : typography.headline,
              {
                color:
                  tone === 'primary'
                    ? colors.textInverse
                    : tone === 'destructive'
                      ? colors.danger
                      : tone === 'text'
                        ? colors.primary
                        : colors.textPrimary,
              },
            ]}
          >
            {buttonContent}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function PrimaryButton(props: ButtonProps) {
  return <ThemedButton {...props} tone="primary" />;
}

export function SecondaryButton(props: ButtonProps) {
  return <ThemedButton {...props} tone="secondary" />;
}

export function DestructiveButton(props: ButtonProps) {
  return <ThemedButton {...props} tone="destructive" />;
}

export function TextButton(props: ButtonProps) {
  return <ThemedButton {...props} tone="text" />;
}

export type IconButtonProps = CommonAccessibilityProps & {
  icon: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewComponentStyle;
};

export function IconButton({
  icon,
  onPress,
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
  accessibilityHint,
}: IconButtonProps) {
  const { theme } = useAppTheme();
  const { colors, sizes } = theme;
  const isDisabled = disabled || loading;

  const handlePress = () => {
    triggerLightImpactHaptic();
    onPress?.();
  };

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: pressed ? colors.backgroundSecondary : 'transparent',
          minHeight: sizes.touchTargetMinimum,
          minWidth: sizes.touchTargetMinimum,
          opacity: isDisabled ? theme.opacities.disabled : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.primary} size="small" /> : icon}
    </Pressable>
  );
}

export type FloatingActionButtonProps = IconButtonProps & {
  label?: string;
};

export function FloatingActionButton({ label, ...props }: FloatingActionButtonProps) {
  const { theme } = useAppTheme();
  const { colors, radius, sizes, shadows, spacing } = theme;

  return (
    <IconButton
      {...props}
      accessibilityHint={props.accessibilityHint ?? label}
      icon={
        label ? (
          <View style={[styles.content, { gap: spacing.xs }]}>
            {props.icon}
            <Text style={[theme.typography.headline, { color: colors.textInverse }]}>{label}</Text>
          </View>
        ) : (
          props.icon
        )
      }
      style={[
        styles.floating,
        {
          backgroundColor: colors.primary,
          borderRadius: radius.pill,
          minHeight: sizes.touchTargetMinimum,
          minWidth: sizes.touchTargetMinimum,
          paddingHorizontal: label ? spacing.md : 0,
          ...shadows.elevated,
        },
        props.style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  floating: {
    alignSelf: 'flex-start',
  },
});
