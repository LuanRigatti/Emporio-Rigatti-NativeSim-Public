import { Host, Image } from '@expo/ui/swift-ui';
import { Animation, animation, opacity, scaleEffect } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';

import type { SplashVisualProps } from './SplashVisual.types';

export default function SplashNativeSwiftUI({ phase }: SplashVisualProps) {
  const insets = useSafeAreaInsets();
  const { reduceMotionEnabled, resolvedMode, theme } = useAppTheme();
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
            backgroundColor: theme.colors.brand,
            borderColor: theme.colors.glassBorder,
            borderRadius: theme.radius.xl,
          },
        ]}
      >
        <Host colorScheme={resolvedMode} matchContents style={styles.host}>
          <Image
            color={theme.colors.brandStrong}
            modifiers={transitionModifiers}
            size={theme.sizes.iconLarge + 8}
            systemName="drop.fill"
          />
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
    height: 92,
    justifyContent: 'center',
    width: 92,
  },
  host: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
