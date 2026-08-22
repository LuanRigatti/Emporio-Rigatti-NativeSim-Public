import * as SplashScreen from 'expo-splash-screen';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { useBiometricUnlock } from '@/hooks/useBiometricUnlock';
import { useInitialCacheHydration, useSession } from '@/providers';
import { useAppTheme } from '@/theme';

import SplashVisual from './components/SplashVisual';

export function SplashGate() {
  const router = useRouter();
  const { isAuthenticated, isLoading: sessionLoading, user } = useSession();
  const isCacheHydrated = useInitialCacheHydration();
  const { isReady: themeReady, reduceMotionEnabled, resolvedMode } = useAppTheme();
  const {
    error: biometricError,
    isLocked: biometricLocked,
    isReady: biometricReady,
    retry: retryBiometric,
  } = useBiometricUnlock({
    activeSession: isAuthenticated && !sessionLoading,
    authenticateOnMount: true,
    sessionKey: user?.id,
  });
  const [overlayReady, setOverlayReady] = useState(false);
  const [startReveal, setStartReveal] = useState(false);
  const hideStartedRef = useRef(false);
  const navigationStartedRef = useRef(false);
  const biometricAlertErrorRef = useRef<string | null>(null);

  const destinationHref = isAuthenticated ? '/(tabs)/dashboard' : '/login';

  useEffect(() => {
    if (
      !themeReady ||
      !overlayReady ||
      !isCacheHydrated ||
      sessionLoading ||
      (isAuthenticated && !biometricReady) ||
      hideStartedRef.current
    ) {
      return;
    }

    hideStartedRef.current = true;

    void SplashScreen.hideAsync()
      .catch(() => {
        SplashScreen.hide();
      })
      .finally(() => {
        setStartReveal(true);
      });
  }, [
    biometricReady,
    isAuthenticated,
    isCacheHydrated,
    overlayReady,
    sessionLoading,
    themeReady,
  ]);

  useEffect(() => {
    if (!biometricLocked) {
      biometricAlertErrorRef.current = null;
      return;
    }

    if (!biometricError || biometricAlertErrorRef.current === biometricError) {
      return;
    }

    biometricAlertErrorRef.current = biometricError;
    Alert.alert(
      'Desbloqueio necessário',
      'Use o Face ID para desbloquear o aplicativo.',
      [{ text: 'Tentar novamente', onPress: () => void retryBiometric() }],
      { cancelable: false },
    );
  }, [biometricError, biometricLocked, retryBiometric]);

  const handleOverlayReady = useCallback(() => setOverlayReady(true), []);
  const handleAnimationComplete = useCallback(() => {
    if (navigationStartedRef.current) return;

    navigationStartedRef.current = true;
    router.replace(destinationHref);
  }, [destinationHref, router]);

  return (
    <View style={styles.root}>
      <SplashVisual
        colorScheme={resolvedMode}
        onAnimationComplete={handleAnimationComplete}
        onOverlayReady={handleOverlayReady}
        reduceMotion={reduceMotionEnabled}
        startReveal={startReveal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
