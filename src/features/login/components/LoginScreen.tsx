import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/premium';
import { useSession } from '@/providers';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import { GoogleMark } from './GoogleMark';

export type LoginScreenProps = {
  onAuthenticated: () => void;
};

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const insets = useSafeAreaInsets();
  const { signInWithGoogleMock } = useSession();
  const { reduceMotionEnabled, resolvedMode, theme } = useAppTheme();
  const [isLoading, setIsLoading] = useState(false);
  const isMounted = useRef(true);
  const hasSubmittedRef = useRef(false);
  const entrance = useSharedValue(0);

  useEffect(() => {
    entrance.value = withTiming(1, {
      duration: reduceMotionEnabled
        ? theme.animations.duration.instant
        : theme.animations.duration.standard,
      easing: Easing.out(Easing.cubic),
    });
  }, [entrance, reduceMotionEnabled, theme]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [
      { translateY: interpolate(entrance.value, [0, 1], [theme.spacing.lg, 0]) },
      { scale: interpolate(entrance.value, [0, 1], [0.98, 1]) },
    ],
  }));

  const handleGooglePress = useCallback(async () => {
    if (isLoading || hasSubmittedRef.current) return;

    hasSubmittedRef.current = true;
    triggerLightImpactHaptic();
    setIsLoading(true);
    await signInWithGoogleMock();

    if (isMounted.current) {
      onAuthenticated();
    }
  }, [isLoading, onAuthenticated, signInWithGoogleMock]);

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
        pointerEvents="none"
        style={[
          styles.orb,
          styles.orbTop,
          {
            backgroundColor: theme.colors.brand,
            opacity: resolvedMode === 'dark' ? 0.14 : 0.28,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.orb,
          styles.orbBottom,
          {
            backgroundColor: theme.colors.primary,
            opacity: resolvedMode === 'dark' ? 0.08 : 0.05,
          },
        ]}
      />

      <Animated.View style={[styles.content, contentStyle]}>
        <View style={styles.brandGroup}>
          <View
            style={[
              styles.logoSurface,
              {
                backgroundColor: theme.colors.brand,
                borderColor: theme.colors.glassBorder,
                borderRadius: theme.radius.xl,
              },
            ]}
          >
            <Ionicons
              color={theme.colors.brandStrong}
              name="water"
              size={theme.sizes.iconLarge + 8}
            />
          </View>
          <Text
            style={[
              theme.typography.largeTitle,
              styles.appName,
              { color: theme.colors.textPrimary },
            ]}
          >
            PAReact
          </Text>
          <Text
            style={[theme.typography.title2, styles.welcome, { color: theme.colors.textPrimary }]}
          >
            Bem-vindo de volta.
          </Text>
          <Text
            style={[
              theme.typography.subheadline,
              styles.description,
              { color: theme.colors.textSecondary },
            ]}
          >
            Entre para continuar sua operação com simplicidade.
          </Text>
        </View>

        <View style={styles.actions}>
          <GlassSurface interactive style={styles.buttonSurface}>
            <Pressable
              accessibilityHint="Simula a entrada com uma conta Google"
              accessibilityLabel={isLoading ? 'Entrando' : 'Continuar com Google'}
              accessibilityRole="button"
              accessibilityState={{ busy: isLoading, disabled: isLoading }}
              disabled={isLoading}
              onPress={handleGooglePress}
              style={({ pressed }) => [
                styles.googleButton,
                {
                  backgroundColor: pressed ? theme.colors.glassBorder : 'transparent',
                  borderRadius: theme.radius.pill,
                  minHeight: theme.sizes.touchTargetMinimum,
                  opacity: isLoading ? theme.opacities.disabled : 1,
                },
              ]}
            >
              <GoogleMark size={20} />
              <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                {isLoading ? 'Entrando...' : 'Continuar com Google'}
              </Text>
              {isLoading ? (
                <ActivityIndicator color={theme.colors.textSecondary} size="small" />
              ) : null}
            </Pressable>
          </GlassSurface>

          <Text
            style={[theme.typography.caption, styles.terms, { color: theme.colors.textTertiary }]}
          >
            Ao continuar, você concorda com os Termos de Uso e a Política de Privacidade.
          </Text>
        </View>
      </Animated.View>
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
  content: {
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 420,
    width: '100%',
  },
  brandGroup: {
    alignItems: 'center',
  },
  logoSurface: {
    alignItems: 'center',
    borderWidth: 1,
    height: 92,
    justifyContent: 'center',
    width: 92,
  },
  appName: {
    marginTop: 18,
  },
  welcome: {
    marginTop: 44,
    textAlign: 'center',
  },
  description: {
    marginTop: 8,
    maxWidth: 300,
    textAlign: 'center',
  },
  actions: {
    alignItems: 'center',
    marginTop: 64,
    width: '100%',
  },
  buttonSurface: {
    width: '100%',
  },
  googleButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  terms: {
    marginTop: 16,
    maxWidth: 320,
    textAlign: 'center',
  },
  orb: {
    borderRadius: 240,
    height: 240,
    position: 'absolute',
    width: 240,
  },
  orbTop: {
    right: -92,
    top: -80,
  },
  orbBottom: {
    bottom: -96,
    left: -92,
  },
});
