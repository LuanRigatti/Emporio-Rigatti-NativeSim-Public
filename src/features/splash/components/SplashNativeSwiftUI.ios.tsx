import { Host, Image, Text, VStack } from '@expo/ui/swift-ui';
import { Animation, animation, opacity, scaleEffect } from '@expo/ui/swift-ui/modifiers';
import { GlassView } from 'expo-glass-effect';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useVisualCapabilities } from '@/theme';

import type { SplashVisualProps } from './SplashVisual.types';

export default function SplashNativeSwiftUI({ phase }: SplashVisualProps) {
  const insets = useSafeAreaInsets();
  const { reduceMotionEnabled, resolvedMode, theme } = useAppTheme();
  const { useGlass } = useVisualCapabilities();
  const isVisible = phase === 'visible';
  const animationDuration = reduceMotionEnabled ? 0 : theme.animations.duration.slow / 1000;
  const transitionAnimation = Animation.easeOut({ duration: animationDuration });
  const transitionModifiers = [
    opacity(isVisible ? 1 : 0),
    scaleEffect(isVisible ? 1 : 0.96),
    animation(transitionAnimation, isVisible),
  ];

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.colors.background,
          paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
          paddingTop: Math.max(insets.top, theme.spacing.lg),
        },
      ]}
    >
      <View
        style={[
          styles.logoCard,
          {
            borderColor: theme.colors.glassBorder,
            borderRadius: theme.radius.xl,
            overflow: 'hidden',
          },
        ]}
      >
        {useGlass ? (
          <GlassView
            colorScheme={resolvedMode}
            glassEffectStyle={{
              animate: !reduceMotionEnabled,
              animationDuration,
              style: isVisible ? 'regular' : 'none',
            }}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: theme.colors.glassSurface,
                borderRadius: theme.radius.xl,
              },
            ]}
          />
        )}

        <Host colorScheme={resolvedMode} matchContents style={styles.host}>
          <VStack alignment="center" spacing={theme.spacing.md} modifiers={transitionModifiers}>
            <Image
              color={theme.colors.brandStrong}
              size={theme.sizes.iconLarge + 12}
              systemName="drop.fill"
            />
            <Text color={theme.colors.textPrimary} design="rounded" size={34} weight="bold">
              PAReact
            </Text>
          </VStack>
        </Host>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 24,
  },
  logoCard: {
    alignItems: 'center',
    borderWidth: 1,
    height: 184,
    justifyContent: 'center',
    width: 284,
  },
  host: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    width: 284,
  },
});
