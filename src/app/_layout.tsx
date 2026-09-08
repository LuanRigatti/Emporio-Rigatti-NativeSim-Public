import {
  DefaultTheme,
  Stack,
  useRouter,
  ThemeProvider as NavigationThemeProvider,
  usePathname,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Font from 'expo-font';
import { useEffect, useMemo, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';

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
import { ThemeProvider, useAppTheme } from '@/theme';
import { QuickActionRouter } from '@/features/quick-actions/QuickActionRouter';
import { RootToolbarProvider, useRootToolbarItems } from '@/navigation/RootToolbarContext';

void SplashScreen.preventAutoHideAsync();

function AppShell() {
  const { status, user } = useSession();
  const { resolvedMode, theme } = useAppTheme();
  const pathname = usePathname();
  const router = useRouter();
  const rootToolbarItems = useRootToolbarItems();
  const isAuthenticated = status === 'authenticated' && Boolean(user?.id);
  const isSessionLoading = status === 'loading';
  const isStartupRoute = pathname === '/';
  const configDetailScreenOptions = {
    animation: 'default' as const,
    headerShadowVisible: false,
    headerShown: true,
    headerTitle: '',
    headerTransparent: true,
    unstable_nativeProps: {
      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
    },
  };
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);
  const isCacheHydrated =
    status === 'loading'
      ? false
      : status !== 'authenticated' || !user?.id
        ? true
        : hydratedUserId === user.id;
  const biometricUnlock = useBiometricUnlock({
    activeSession: isAuthenticated && pathname !== '/' && pathname !== '/login',
    relockOnBackground: true,
    sessionKey: user?.id,
  });
  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      dark: resolvedMode === 'dark',
      colors: {
        ...DefaultTheme.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.background,
        text: theme.colors.textPrimary,
        border: theme.colors.separator,
        notification: theme.colors.danger,
      },
    }),
    [resolvedMode, theme],
  );

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
        <QuickActionRouter />
        <KeyboardProvider>
          <NavigationThemeProvider value={navigationTheme}>
            <Stack screenOptions={{ animation: 'default', headerShown: false }}>
              <Stack.Protected guard={isSessionLoading || isAuthenticated || isStartupRoute}>
                <Stack.Screen
                  name="index"
                  options={{ animation: 'default', gestureEnabled: false }}
                />
              </Stack.Protected>
              <Stack.Protected guard={!isSessionLoading && !isAuthenticated}>
                <Stack.Screen
                  name="login"
                  options={{
                    animation: 'default',
                    animationTypeForReplace: 'push',
                    gestureEnabled: false,
                  }}
                />
              </Stack.Protected>
              <Stack.Protected guard={isAuthenticated}>
                <Stack.Screen
                  name="(tabs)"
                  options={{
                    gestureEnabled: false,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Toolbar placement="right">{rootToolbarItems}</Stack.Toolbar>
                </Stack.Screen>
                <Stack.Screen
                  name="registrar"
                  options={{ gestureEnabled: true, headerShown: false }}
                />
                <Stack.Screen
                  name="financeiro"
                  options={{ gestureEnabled: true, headerShown: false }}
                />
                <Stack.Screen
                  name="configuracoes/clientes"
                  options={{ ...configDetailScreenOptions, gestureEnabled: true }}
                >
                  <Stack.Toolbar placement="left">
                    <Stack.Toolbar.Button
                      accessibilityLabel="Voltar para Configurações"
                      icon="chevron.left"
                      onPress={() => router.back()}
                    />
                  </Stack.Toolbar>
                </Stack.Screen>
                <Stack.Screen
                  name="configuracoes/clientes/[clientId]"
                  options={{
                    ...configDetailScreenOptions,
                    gestureEnabled: true,
                    headerBackButtonMenuEnabled: false,
                  }}
                >
                  <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="configuracoes/dados-empresa"
                  options={{ ...configDetailScreenOptions, gestureEnabled: true }}
                >
                  <Stack.Toolbar placement="left">
                    <Stack.Toolbar.Button
                      accessibilityLabel="Voltar para Configurações"
                      icon="chevron.left"
                      onPress={() => router.back()}
                    />
                  </Stack.Toolbar>
                </Stack.Screen>
                <Stack.Screen
                  name="configuracoes/fabrica"
                  options={{ ...configDetailScreenOptions, gestureEnabled: true }}
                >
                  <Stack.Toolbar placement="left">
                    <Stack.Toolbar.Button
                      accessibilityLabel="Voltar para Configurações"
                      icon="chevron.left"
                      onPress={() => router.back()}
                    />
                  </Stack.Toolbar>
                </Stack.Screen>
                <Stack.Screen
                  name="configuracoes/fabrica/valor-balde"
                  options={{ ...configDetailScreenOptions, gestureEnabled: true }}
                >
                  <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="configuracoes/fabrica/compras-menu"
                  options={{ ...configDetailScreenOptions, gestureEnabled: true }}
                >
                  <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="configuracoes/fabrica/compras"
                  options={{ ...configDetailScreenOptions, gestureEnabled: true }}
                >
                  <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="configuracoes/fabrica/compras/registrar"
                  options={{ ...configDetailScreenOptions, gestureEnabled: true }}
                >
                  <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="configuracoes/dados"
                  options={{ ...configDetailScreenOptions, gestureEnabled: true }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="configuracoes/dados/mensais"
                  options={{ ...configDetailScreenOptions, gestureEnabled: true }}
                >
                  <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="configuracoes/dados/diarios"
                  options={{ ...configDetailScreenOptions, gestureEnabled: true }}
                >
                  <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="configuracoes/dados/carro"
                  options={{ ...configDetailScreenOptions, gestureEnabled: true }}
                >
                  <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="configuracoes/face-id"
                  options={{ ...configDetailScreenOptions, gestureEnabled: true }}
                >
                  <Stack.Toolbar placement="left">
                    <Stack.Toolbar.Button
                      accessibilityLabel="Voltar para Configurações"
                      icon="chevron.left"
                      onPress={() => router.back()}
                    />
                  </Stack.Toolbar>
                </Stack.Screen>
                <Stack.Screen
                  name="configuracoes/sistema"
                  options={{ ...configDetailScreenOptions, gestureEnabled: true }}
                >
                  <Stack.Toolbar placement="left">
                    <Stack.Toolbar.Button
                      accessibilityLabel="Voltar para Configurações"
                      icon="chevron.left"
                      onPress={() => router.back()}
                    />
                  </Stack.Toolbar>
                </Stack.Screen>
                <Stack.Screen
                  name="configuracoes/modo-teste"
                  options={{ ...configDetailScreenOptions, gestureEnabled: true }}
                >
                  <Stack.Toolbar placement="left">
                    <Stack.Toolbar.Button
                      accessibilityLabel="Voltar para Configurações"
                      icon="chevron.left"
                      onPress={() => router.back()}
                    />
                  </Stack.Toolbar>
                </Stack.Screen>
                <Stack.Screen
                  name="configuracoes/backup"
                  options={{ ...configDetailScreenOptions, gestureEnabled: true }}
                >
                  <Stack.Toolbar placement="left">
                    <Stack.Toolbar.Button
                      accessibilityLabel="Voltar para Configurações"
                      icon="chevron.left"
                      onPress={() => router.back()}
                    />
                  </Stack.Toolbar>
                </Stack.Screen>
                <Stack.Screen
                  name="configuracoes/estoque"
                  options={{ ...configDetailScreenOptions, gestureEnabled: true }}
                >
                  <Stack.Toolbar placement="left">
                    <Stack.Toolbar.Button
                      accessibilityLabel="Voltar para Configurações"
                      icon="chevron.left"
                      onPress={() => router.back()}
                    />
                  </Stack.Toolbar>
                </Stack.Screen>
                <Stack.Screen
                  name="configuracoes/localizacao"
                  options={{ ...configDetailScreenOptions, gestureEnabled: false }}
                >
                  <Stack.Toolbar placement="left">
                    <Stack.Toolbar.Button
                      accessibilityLabel="Voltar para Configurações"
                      icon="chevron.left"
                      onPress={() => router.back()}
                    />
                  </Stack.Toolbar>
                </Stack.Screen>
                <Stack.Screen
                  name="configuracoes/localizacao/[routeId]"
                  options={{ ...configDetailScreenOptions, gestureEnabled: true }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="(home-shortcuts)"
                  options={{ gestureEnabled: true, headerShown: false }}
                />
                <Stack.Screen name="fabrica-compras-menu" />
                <Stack.Screen name="fabrica-compras-registrar" />
                <Stack.Screen name="fabrica-valor-balde" />
                <Stack.Screen name="fabrica" />
                <Stack.Screen name="pagamentos-em-aberto" />
                <Stack.Screen name="em-aberto" />
                <Stack.Screen name="dev/native-components-showcase" />
              </Stack.Protected>
            </Stack>
          </NavigationThemeProvider>
        </KeyboardProvider>
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
                <RootToolbarProvider>
                  <AppShell />
                </RootToolbarProvider>
              </TestModeProvider>
            </ThemeProvider>
          </SessionProvider>
        </AppSafeAreaProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
