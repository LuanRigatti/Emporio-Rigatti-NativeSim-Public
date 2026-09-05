import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { darkModeCardSurface, useAppTheme } from '@/theme';

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
      backgroundColor: resolvedMode === 'dark' ? darkModeCardSurface : theme.colors.glassSurface,
      borderRadius: theme.radius.card,
      padding: theme.spacing.lg,
    },
    style,
  ];

  const surface = (
    <GlassSurface {...props} glassEffectStyle="none" style={surfaceStyle}>
      {children}
    </GlassSurface>
  );

  if (!onPress) {
    return (
      <View
        style={[
          { borderRadius: theme.radius.card },
          resolvedMode === 'dark'
            ? theme.shadows.none
            : elevated
              ? theme.shadows.elevated
              : theme.shadows.card,
        ]}
      >
        {surface}
      </View>
    );
  }

  return (
    <AnimatedPressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        { borderRadius: theme.radius.card },
        resolvedMode === 'dark'
          ? theme.shadows.none
          : elevated
            ? theme.shadows.elevated
            : theme.shadows.card,
      ]}
    >
      {surface}
    </AnimatedPressable>
  );
}
