import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { CrossScreenGlassMorphProvider, TransientGlassMorphHost } from '@/components/native';
import { SessionProvider, useSession } from '@/providers';
import { BiometricLockOverlay } from '@/components/auth/BiometricLockOverlay';
import { useBiometricUnlock } from '@/hooks/useBiometricUnlock';
import { financialPeriodSnapshotCache } from '@/services/finance/FinancialPeriodSnapshotCache';
import { firestoreClientDataSource } from '@/services/clients';
import { firestoreDeliveryDataSource } from '@/services/deliveries';
import { locationTrackingService, routeTrackingRepository } from '@/services/routes';
import { stockPeriodSnapshotCache } from '@/services/stock/StockPeriodSnapshotCache';
import { ThemeProvider } from '@/theme';

void SplashScreen.preventAutoHideAsync();

function AppShell() {
  const { status, user } = useSession();
  const pathname = usePathname();
  const biometricUnlock = useBiometricUnlock({
    activeSession:
      status === 'authenticated' && Boolean(user?.id) && pathname !== '/' && pathname !== '/login',
    relockOnBackground: true,
    sessionKey: user?.id,
  });

  useEffect(() => {
    void locationTrackingService.restoreActiveRouteAfterAppRestart().catch((error) => {
      if (__DEV__) console.warn('[RouteTracking] Falha ao restaurar rota ativa.', error);
    });
    void routeTrackingRepository.getRouteHistory().catch((error) => {
      if (__DEV__) console.warn('[RouteTracking] Falha ao hidratar histórico de rotas.', error);
    });
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    void financialPeriodSnapshotCache.read(user.id, currentMonth);
    void stockPeriodSnapshotCache.read(user.id, currentMonth);
    void firestoreClientDataSource.hydrateFromCache(user.id);
    void firestoreDeliveryDataSource.hydrateFromCache(user.id);
    void routeTrackingRepository.getRouteHistory();
  }, [user?.id]);

  return (
    <>
      <Stack screenOptions={{ animation: 'default', headerShown: false }}>
        <Stack.Screen name="index" options={{ animation: 'default', gestureEnabled: false }} />
        <Stack.Screen
          name="login"
          options={{
            animation: 'default',
            animationTypeForReplace: 'push',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
      </Stack>
      <BiometricLockOverlay
        onRetry={biometricUnlock.retry}
        showRetry={biometricUnlock.canRetry}
        visible={biometricUnlock.isPrivacyActive}
      />
      <TransientGlassMorphHost />
    </>
  );
}

export default function PrototypeRootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SessionProvider>
          <ThemeProvider>
            <CrossScreenGlassMorphProvider>
              <AppShell />
            </CrossScreenGlassMorphProvider>
          </ThemeProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
