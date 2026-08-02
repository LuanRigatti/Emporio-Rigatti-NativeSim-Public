import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';
import { GlassSurface, type GlassSurfaceProps } from './GlassSurface';

export type GlassCardProps = Omit<GlassSurfaceProps, 'children' | 'style'> & {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  elevated?: boolean;
};

export function GlassCard({
  accessibilityHint,
  accessibilityLabel,
  children,
  elevated = false,
  onPress,
  style,
  ...props
}: GlassCardProps) {
  const { resolvedMode, theme } = useAppTheme();
  const surfaceStyle = [
    {
      backgroundColor: resolvedMode === 'dark' ? '#131417' : theme.colors.glassSurface,
      borderRadius: theme.radius.card,
      padding: theme.spacing.lg,
    },
    elevated ? theme.shadows.elevated : undefined,
    style,
  ];

  const surface = (
    <GlassSurface {...props} glassEffectStyle="none" style={surfaceStyle}>
      {children}
    </GlassSurface>
  );

  if (!onPress) return surface;

  return (
    <AnimatedPressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
    >
      {surface}
    </AnimatedPressable>
  );
}
