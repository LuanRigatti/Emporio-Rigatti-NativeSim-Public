import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Font from 'expo-font';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import {
  AppSafeAreaProvider,
  InitialCacheHydrationContext,
  SessionProvider,
  TestModeProvider,
  useSession,
} from '@/providers';
import { BiometricLockOverlay } from '@/components/auth/BiometricLockOverlay';
import { useBiometricUnlock } from '@/hooks/useBiometricUnlock';
import { financialPeriodSnapshotCache } from '@/services/finance/FinancialPeriodSnapshotCache';
import { firestoreClientDataSource } from '@/services/clients';
import { firestoreDeliveryDataSource } from '@/services/deliveries';
import { factoryReceiptDataSource } from '@/services/factory-purchases';
import { locationTrackingService, routeTrackingRepository } from '@/services/routes';
import { stockPeriodSnapshotCache } from '@/services/stock/StockPeriodSnapshotCache';
import { ThemeProvider } from '@/theme';

void SplashScreen.preventAutoHideAsync();

function AppShell() {
  const { status, user } = useSession();
  const pathname = usePathname();
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);
  const isCacheHydrated =
    status === 'loading'
      ? false
      : status !== 'authenticated' || !user?.id
        ? true
        : hydratedUserId === user.id;
  const biometricUnlock = useBiometricUnlock({
    activeSession:
      status === 'authenticated' && Boolean(user?.id) && pathname !== '/' && pathname !== '/login',
    relockOnBackground: true,
    sessionKey: user?.id,
  });

  useEffect(() => {
    let active = true;

    if (status !== 'authenticated' || !user?.id) {
      return () => {
        active = false;
      };
    }

    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    void Promise.allSettled([
      firestoreClientDataSource.hydrateFromCache(user.id),
      firestoreDeliveryDataSource.hydrateFromCache(user.id),
      factoryReceiptDataSource.restore(user.id, { month: currentMonth, period: 'month' }),
      Font.loadAsync(Ionicons.font),
    ]).finally(() => {
      if (active) setHydratedUserId(user.id);
    });

    return () => {
      active = false;
    };
  }, [status, user?.id]);

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
    void routeTrackingRepository.getRouteHistory();
  }, [user?.id]);

  return (
    <InitialCacheHydrationContext.Provider value={isCacheHydrated}>
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
          <Stack.Screen name="(tabs)" options={{ gestureEnabled: false, headerShown: false }} />
          <Stack.Screen
            name="(home-shortcuts)"
            options={{ gestureEnabled: true, headerShown: false }}
          />
        </Stack>
        <BiometricLockOverlay
          onRetry={biometricUnlock.retry}
          showRetry={biometricUnlock.canRetry}
          visible={biometricUnlock.isPrivacyActive}
        />
      </>
    </InitialCacheHydrationContext.Provider>
  );
}

export default function PrototypeRootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <AppSafeAreaProvider>
          <SessionProvider>
            <ThemeProvider>
              <TestModeProvider>
                <AppShell />
              </TestModeProvider>
            </ThemeProvider>
          </SessionProvider>
        </AppSafeAreaProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
