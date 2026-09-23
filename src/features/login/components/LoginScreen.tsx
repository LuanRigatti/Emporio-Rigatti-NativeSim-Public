import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InlineError } from '@/components/feedback';
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
  const { authDiagnostic, signInWithGoogleNative } = useSession();
  const { theme } = useAppTheme();
  const [isLoading, setIsLoading] = useState(false);
  const isMounted = useRef(true);
  const hasSubmittedRef = useRef(false);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleGooglePress = useCallback(async () => {
    if (isLoading || hasSubmittedRef.current) return;

    hasSubmittedRef.current = true;
    triggerLightImpactHaptic();
    setIsLoading(true);
    try {
      await signInWithGoogleNative();

      if (isMounted.current) {
        onAuthenticated();
      }
    } catch {
      hasSubmittedRef.current = false;
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [isLoading, onAuthenticated, signInWithGoogleNative]);

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
              accessibilityLabel={isLoading ? 'Entrando' : 'Login com Google'}
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
                {isLoading ? 'Entrando...' : 'Login com Google'}
              </Text>
              {isLoading ? (
                <ActivityIndicator color={theme.colors.textSecondary} size="small" />
              ) : null}
            </Pressable>
          </GlassSurface>
          {authDiagnostic ? (
            <View
              accessibilityLiveRegion="assertive"
              accessibilityRole="alert"
              style={[
                styles.diagnostic,
                {
                  backgroundColor: theme.colors.dangerSurface,
                  borderColor: theme.colors.danger,
                  borderRadius: theme.radius.md,
                  borderWidth: theme.borders.width.hairline,
                  padding: theme.spacing.sm,
                },
              ]}
            >
              <Text style={[theme.typography.footnote, { color: theme.colors.danger }]}>
                Auth diagnostic
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>
                Stage: {authDiagnostic.stage}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>
                Code: {authDiagnostic.code}
              </Text>
              <InlineError message={authDiagnostic.message} style={styles.diagnosticMessage} />
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                Events: {authDiagnostic.events.join(' → ')}
              </Text>
            </View>
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
    marginTop: 16,
    width: '100%',
  },
  buttonSurface: {
    alignSelf: 'center',
    width: '60%',
  },
  diagnostic: {
    marginTop: 12,
    width: '100%',
  },
  diagnosticMessage: {
    marginTop: 2,
  },
  googleButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
});
