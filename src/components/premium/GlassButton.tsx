import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { ComponentProps } from 'react';

import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import { AnimatedPressable } from './AnimatedPressable';
import { GlassSurface } from './GlassSurface';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type GlassButtonVariant = 'glass' | 'primary' | 'secondary' | 'destructive';

export type GlassButtonProps = {
  label: string;
  onPress: () => void;
  variant?: GlassButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function GlassButton({
  label,
  onPress,
  variant = 'glass',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  accessibilityLabel,
  accessibilityHint,
}: GlassButtonProps) {
  const { theme } = useAppTheme();
  const isDisabled = disabled || loading;
  const isGlass = variant === 'glass';
  const backgroundColor = {
    glass: theme.colors.glassSurface,
    primary: theme.colors.primary,
    secondary: theme.colors.surfaceMuted,
    destructive: theme.colors.danger,
  }[variant];
  const foregroundColor =
    variant === 'primary' || variant === 'destructive'
      ? theme.colors.textInverse
      : theme.colors.textPrimary;

  const content = (
    <View style={[styles.content, { gap: theme.spacing.xs }]}>
      {loading ? (
        <ActivityIndicator color={foregroundColor} />
      ) : icon ? (
        <Ionicons name={icon} size={theme.sizes.iconSmall} color={foregroundColor} />
      ) : null}
      <Text style={[theme.typography.headline, { color: foregroundColor }]}>{label}</Text>
    </View>
  );

  const button = (
    <AnimatedPressable
      onPress={() => {
        triggerLightImpactHaptic();
        onPress();
      }}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.button,
        {
          backgroundColor,
          borderColor: variant === 'glass' ? theme.colors.glassBorder : backgroundColor,
          borderRadius: theme.radius.pill,
          minHeight: theme.sizes.touchTargetMinimum,
          paddingHorizontal: theme.spacing.lg,
          opacity: isDisabled ? theme.opacities.disabled : 1,
        },
        fullWidth && styles.fullWidth,
      ]}
    >
      {content}
    </AnimatedPressable>
  );

  return isGlass ? (
    <GlassSurface style={fullWidth && styles.fullWidth}>{button}</GlassSurface>
  ) : (
    button
  );
}

const styles = StyleSheet.create({
  button: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  fullWidth: { width: '100%' },
});
