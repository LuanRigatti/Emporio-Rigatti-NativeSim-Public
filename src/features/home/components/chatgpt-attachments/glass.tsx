import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import Animated, { type AnimatedProps } from 'react-native-reanimated';
import { COLORS } from './constants';

const LIQUID_GLASS = isLiquidGlassAvailable();
const BLURS_ITS_BACKDROP = Platform.OS !== 'android';
const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);

export type GlassStyleName = 'regular' | 'none';

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

export interface GlassProps extends ViewProps {
  fallbackTint?: string;
  radius?: number;
  active?: boolean;
  interactive?: boolean;
  duration?: number;
  children?: ReactNode;
}

/** The source demo's glass surface, kept as one native material per surface. */
export function Glass({
  fallbackTint,
  radius = 0,
  active = true,
  interactive = true,
  duration = 0.25,
  style,
  children,
  ...rest
}: GlassProps) {
  const glassEffectStyle = useGlassStyle(active ? 'regular' : 'none', duration);

  if (!LIQUID_GLASS) {
    return (
      <BlurView
        intensity={60}
        tint="systemChromeMaterialDark"
        style={[shapeOf(radius), styles.clip, style]}
        {...rest}
      >
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: fallbackTint ?? COLORS.controlScrim },
          ]}
        />
        {children}
      </BlurView>
    );
  }

  return (
    <GlassView
      glassEffectStyle={glassEffectStyle}
      colorScheme="dark"
      isInteractive={interactive}
      style={[shapeOf(radius), style]}
      {...rest}
    >
      {children}
    </GlassView>
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
  const glassEffectStyle = useGlassStyle(variant, duration);

  if (!LIQUID_GLASS) {
    if (variant === 'none') return null;
    return (
      <Animated.View pointerEvents="none" style={[styles.clip, style]}>
        {BLURS_ITS_BACKDROP ? (
          <BlurView
            intensity={70}
            tint="systemUltraThinMaterialDark"
            style={StyleSheet.absoluteFill}
          >
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.fallbackTint]} />
          </BlurView>
        ) : (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flatMaterial]} />
        )}
      </Animated.View>
    );
  }

  return (
    <AnimatedGlassView
      glassEffectStyle={glassEffectStyle}
      colorScheme="dark"
      isInteractive
      style={[styles.shape, style]}
    />
  );
}

const styles = StyleSheet.create({
  shape: { borderCurve: 'continuous' },
  clip: { overflow: 'hidden' },
  fallbackTint: { backgroundColor: COLORS.material },
  flatMaterial: { backgroundColor: COLORS.materialFlat },
});
