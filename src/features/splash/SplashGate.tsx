import * as SplashScreen from 'expo-splash-screen';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSession } from '@/providers';
import { useAppTheme } from '@/theme';

import SplashVisual from './components/SplashVisual';

export type SplashGateProps = {
  children: ReactNode;
};

export function SplashGate({ children }: SplashGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const routeSegments = segments as string[];
  const { checkAuthentication } = useSession();
  const { isReady: themeReady, reduceMotionEnabled, resolvedMode } = useAppTheme();
  const [destination, setDestination] = useState<'login' | 'dashboard' | null>(null);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [overlayReady, setOverlayReady] = useState(false);
  const [startReveal, setStartReveal] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const hasCheckedSessionRef = useRef(false);
  const hideStartedRef = useRef(false);

  const destinationHref = useMemo(
    () => (destination === 'dashboard' ? '/(tabs)/dashboard' : '/login'),
    [destination],
  );

  const destinationReady =
    (destination === 'login' && (pathname === '/login' || segments[0] === 'login')) ||
    (destination === 'dashboard' &&
      (pathname === '/dashboard' ||
        (routeSegments[0] === '(tabs)' && routeSegments[1] === 'dashboard')));

  useEffect(() => {
    if (hasCheckedSessionRef.current) return;
    hasCheckedSessionRef.current = true;

    let isMounted = true;

    void (async () => {
      let isLogged = false;

      try {
        isLogged = await checkAuthentication();
      } catch {
        // Authentication failures stay on the safe unauthenticated route.
      }

      if (!isMounted) return;
      setDestination(isLogged ? 'dashboard' : 'login');
      setSessionResolved(true);
    })();

    return () => {
      isMounted = false;
    };
  }, [checkAuthentication]);

  useEffect(() => {
    if (!destination) return;
    if (destinationReady) return;

    router.replace(destinationHref);
  }, [destination, destinationHref, destinationReady, router]);

  useEffect(() => {
    if (
      startReveal ||
      isComplete ||
      !sessionResolved ||
      !destination ||
      !destinationReady ||
      !themeReady ||
      !overlayReady
    ) {
      return;
    }

    if (hideStartedRef.current) return;
    hideStartedRef.current = true;

    let isMounted = true;

    void SplashScreen.hideAsync()
      .catch(() => {
        SplashScreen.hide();
      })
      .finally(() => {
        if (isMounted) {
          setStartReveal(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    destination,
    destinationReady,
    isComplete,
    overlayReady,
    sessionResolved,
    startReveal,
    themeReady,
  ]);

  const handleOverlayReady = useCallback(() => setOverlayReady(true), []);
  const handleAnimationComplete = useCallback(() => setIsComplete(true), []);

  return (
    <View style={styles.root}>
      <View style={styles.content}>{children}</View>
      {!isComplete ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <SplashVisual
            colorScheme={resolvedMode}
            onAnimationComplete={handleAnimationComplete}
            onOverlayReady={handleOverlayReady}
            reduceMotion={reduceMotionEnabled}
            startReveal={startReveal}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
});
