import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider, useSession } from '@/providers';
import { financialPeriodSnapshotCache } from '@/services/finance/FinancialPeriodSnapshotCache';
import { firestoreClientDataSource } from '@/services/clients';
import { locationTrackingService } from '@/services/routes';
import { stockPeriodSnapshotCache } from '@/services/stock/StockPeriodSnapshotCache';
import { ThemeProvider } from '@/theme';

void SplashScreen.preventAutoHideAsync();

function AppShell() {
  const { user } = useSession();

  useEffect(() => {
    void locationTrackingService.restoreActiveRouteAfterAppRestart().catch((error) => {
      if (__DEV__) console.warn('[RouteTracking] Falha ao restaurar rota ativa.', error);
    });
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    void financialPeriodSnapshotCache.read(user.id, currentMonth);
    void stockPeriodSnapshotCache.read(user.id, currentMonth);
    void firestoreClientDataSource.hydrateFromCache(user.id);
  }, [user?.id]);

  return (
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
  );
}

export default function PrototypeRootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <ThemeProvider>
            <AppShell />
          </ThemeProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
