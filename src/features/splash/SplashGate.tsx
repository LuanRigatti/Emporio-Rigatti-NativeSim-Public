import * as SplashScreen from 'expo-splash-screen';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSession } from '@/providers';
import { useAppTheme } from '@/theme';

import SplashVisual from './components/SplashVisual';

export function SplashGate() {
  const router = useRouter();
  const { isAuthenticated, isLoading: sessionLoading } = useSession();
  const { isReady: themeReady, reduceMotionEnabled, resolvedMode } = useAppTheme();
  const [overlayReady, setOverlayReady] = useState(false);
  const [startReveal, setStartReveal] = useState(false);
  const hideStartedRef = useRef(false);
  const navigationStartedRef = useRef(false);

  const destinationHref = isAuthenticated ? '/(tabs)/dashboard' : '/login';

  useEffect(() => {
    if (!themeReady || !overlayReady || sessionLoading || hideStartedRef.current) return;

    hideStartedRef.current = true;

    void SplashScreen.hideAsync()
      .catch(() => {
        SplashScreen.hide();
      })
      .finally(() => {
        setStartReveal(true);
      });
  }, [overlayReady, sessionLoading, themeReady]);

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
