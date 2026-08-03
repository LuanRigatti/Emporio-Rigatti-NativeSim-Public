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
import { AppLogo } from '@/components/branding/AppLogo';
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
  const { reduceMotionEnabled, theme } = useAppTheme();
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
      <Animated.View style={[styles.content, contentStyle]}>
        <View style={styles.brandGroup}>
          <AppLogo size={336} variant="login" />
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
    flex: 1,
    justifyContent: 'center',
    maxWidth: 420,
    width: '100%',
  },
  brandGroup: {
    alignItems: 'center',
  },
  actions: {
    alignItems: 'center',
    marginTop: 16,
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
});
