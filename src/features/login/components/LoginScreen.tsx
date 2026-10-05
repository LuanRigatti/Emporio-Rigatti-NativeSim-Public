import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/premium';
import { AppLogo } from '@/components/branding/AppLogo';
import { hasQuickLoginCredentials } from '@/config/quickLoginConfig';
import { useSession } from '@/providers';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import { GoogleMark } from './GoogleMark';

export type LoginScreenProps = {
  onAuthenticated: () => void;
};

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const insets = useSafeAreaInsets();
  const { signInWithQuickLogin, signInWithGoogleNative } = useSession();
  const { theme } = useAppTheme();
  const quickLoginConfigured = hasQuickLoginCredentials();
  const [activeLogin, setActiveLogin] = useState<'quick-login' | 'google' | null>(null);
  const [quickLoginError, setQuickLoginError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const hasSubmittedRef = useRef(false);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleGooglePress = useCallback(async () => {
    if (activeLogin || hasSubmittedRef.current) return;

    hasSubmittedRef.current = true;
    triggerLightImpactHaptic();
    setQuickLoginError(null);
    setActiveLogin('google');
    try {
      await signInWithGoogleNative();

      if (isMounted.current) {
        onAuthenticated();
      }
    } catch {
      hasSubmittedRef.current = false;
    } finally {
      if (isMounted.current) {
        setActiveLogin(null);
      }
    }
  }, [activeLogin, onAuthenticated, signInWithGoogleNative]);

  const handleQuickLoginPress = useCallback(async () => {
    if (activeLogin || hasSubmittedRef.current) return;

    hasSubmittedRef.current = true;
    triggerLightImpactHaptic();
    setQuickLoginError(null);
    setActiveLogin('quick-login');
    try {
      await signInWithQuickLogin();

      if (isMounted.current) {
        onAuthenticated();
      }
    } catch (authError) {
      hasSubmittedRef.current = false;
      if (isMounted.current) {
        setQuickLoginError(
          authError instanceof Error
            ? authError.message
            : 'Não foi possível iniciar a entrada rápida. Tente novamente.',
        );
      }
    } finally {
      if (isMounted.current) {
        setActiveLogin(null);
      }
    }
  }, [activeLogin, onAuthenticated, signInWithQuickLogin]);

  const isGoogleLoading = activeLogin === 'google';
  const isQuickLoginLoading = activeLogin === 'quick-login';
  const isAnyLoginLoading = activeLogin !== null;

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
      <View style={styles.content}>
        <View style={styles.brandGroup}>
          <AppLogo size={336} variant="login" />
        </View>

        <View style={styles.actions}>
          <GlassSurface interactive style={styles.buttonSurface}>
            <Pressable
              accessibilityHint="Autentica com uma conta Google usando Firebase"
              accessibilityLabel={isGoogleLoading ? 'Entrando' : 'Login com Google'}
              accessibilityRole="button"
              accessibilityState={{ busy: isGoogleLoading, disabled: isAnyLoginLoading }}
              disabled={isAnyLoginLoading}
              testID="login-google-button"
              onPress={handleGooglePress}
              style={({ pressed }) => [
                styles.googleButton,
                {
                  backgroundColor: pressed ? theme.colors.glassBorder : 'transparent',
                  borderRadius: theme.radius.pill,
                  minHeight: theme.sizes.touchTargetMinimum,
                  opacity: isAnyLoginLoading ? theme.opacities.disabled : 1,
                },
              ]}
            >
              <GoogleMark size={20} />
              <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                {isGoogleLoading ? 'Entrando...' : 'Login com Google'}
              </Text>
              {isGoogleLoading ? (
                <ActivityIndicator color={theme.colors.textSecondary} size="small" />
              ) : null}
            </Pressable>
          </GlassSurface>

          {quickLoginConfigured ? (
            <GlassSurface interactive style={styles.buttonSurface}>
              <Pressable
                accessibilityHint="Entra com a conta Firebase de teste configurada"
                accessibilityLabel={isQuickLoginLoading ? 'Entrando' : 'Entrada rápida'}
                accessibilityRole="button"
                accessibilityState={{ busy: isQuickLoginLoading, disabled: isAnyLoginLoading }}
                disabled={isAnyLoginLoading}
                onPress={handleQuickLoginPress}
                style={({ pressed }) => [
                  styles.quickLoginButton,
                  {
                    backgroundColor: pressed ? theme.colors.glassBorder : 'transparent',
                    borderRadius: theme.radius.pill,
                    minHeight: theme.sizes.touchTargetMinimum,
                    opacity: isAnyLoginLoading ? theme.opacities.disabled : 1,
                  },
                ]}
                testID="login-quick-entry-button"
              >
                <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                  {isQuickLoginLoading ? 'Entrando...' : 'Entrada rápida'}
                </Text>
                {isQuickLoginLoading ? (
                  <ActivityIndicator color={theme.colors.textSecondary} size="small" />
                ) : null}
              </Pressable>
            </GlassSurface>
          ) : null}

          {quickLoginConfigured && quickLoginError ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: theme.colors.danger }]}>
              {quickLoginError}
            </Text>
          ) : null}
        </View>
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
    gap: 12,
    marginTop: 16,
    width: '100%',
  },
  buttonSurface: {
    alignSelf: 'center',
    width: '60%',
  },
  googleButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  quickLoginButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  error: {
    maxWidth: 420,
    textAlign: 'center',
  },
});
