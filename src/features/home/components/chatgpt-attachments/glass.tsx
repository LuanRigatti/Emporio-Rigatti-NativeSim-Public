import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import Animated, { type AnimatedProps } from 'react-native-reanimated';
import { useAppTheme } from '@/theme';
import { COLORS } from './constants';

const LIQUID_GLASS = isLiquidGlassAvailable();
const BLURS_ITS_BACKDROP = Platform.OS !== 'android';
const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export type GlassStyleName = 'clear' | 'regular' | 'none';

function useGlassStyle(target: GlassStyleName, duration: number) {
  const [style, setStyle] = useState<GlassStyleName>('none');
  // The native GlassView needs the state change after mount to run its transition.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setStyle(target), [target]);
  return { style, animate: true, animationDuration: duration };
}

function shapeOf(radius: number): ViewStyle {
  return { borderRadius: radius, borderCurve: 'continuous' };
}

export interface GlassProps extends Omit<ViewProps, 'style'> {
  fallbackTint?: string;
  radius?: number;
  active?: boolean;
  interactive?: boolean;
  variant?: Exclude<GlassStyleName, 'none'>;
  duration?: number;
  style?: AnimatedProps<ViewProps>['style'];
  children?: ReactNode;
}

/** The source demo's glass surface, kept as one native material per surface. */
export function Glass({
  fallbackTint,
  radius = 0,
  active = true,
  interactive = true,
  variant = 'regular',
  duration = 0.25,
  style,
  children,
  ...rest
}: GlassProps) {
  const { resolvedMode, theme } = useAppTheme();
  const glassEffectStyle = useGlassStyle(active ? variant : 'none', duration);
  const resolvedFallbackTint =
    fallbackTint ?? (resolvedMode === 'dark' ? COLORS.controlScrim : theme.colors.glassSurface);

  if (!LIQUID_GLASS) {
    return (
      <AnimatedBlurView
        intensity={60}
        tint={resolvedMode === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
        style={[shapeOf(radius), styles.clip, style]}
        {...rest}
      >
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: resolvedFallbackTint }]}
        />
        {children}
      </AnimatedBlurView>
    );
  }

  return (
    <AnimatedGlassView
      colorScheme={resolvedMode}
      glassEffectStyle={glassEffectStyle}
      isInteractive={interactive}
      style={[shapeOf(radius), style]}
      {...rest}
    >
      {children}
    </AnimatedGlassView>
  );
}

export function PanelMaterial({
  variant,
  duration,
  style,
}: {
  variant: 'regular' | 'none';
  duration: number;
  style?: AnimatedProps<ViewProps>['style'];
}) {
  const { resolvedMode, theme } = useAppTheme();
  const glassEffectStyle = useGlassStyle(variant, duration);

  if (!LIQUID_GLASS) {
    if (variant === 'none') return null;
    return (
      <Animated.View pointerEvents="none" style={[styles.clip, style]}>
        {BLURS_ITS_BACKDROP ? (
          <BlurView
            intensity={70}
            tint={
              resolvedMode === 'dark'
                ? 'systemUltraThinMaterialDark'
                : 'systemUltraThinMaterialLight'
            }
            style={StyleSheet.absoluteFill}
          >
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor:
                    resolvedMode === 'dark' ? COLORS.material : theme.colors.glassSurface,
                },
              ]}
            />
          </BlurView>
        ) : (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor:
                  resolvedMode === 'dark' ? COLORS.materialFlat : theme.colors.surface,
              },
            ]}
          />
        )}
      </Animated.View>
    );
  }

  return (
    <AnimatedGlassView
      colorScheme={resolvedMode}
      glassEffectStyle={glassEffectStyle}
      isInteractive
      style={[styles.shape, style]}
    />
  );
}

const styles = StyleSheet.create({
  shape: { borderCurve: 'continuous' },
  clip: { overflow: 'hidden' },
});
