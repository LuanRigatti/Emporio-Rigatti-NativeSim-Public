import {
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
  usePathname,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Font from 'expo-font';
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import {
  AppSafeAreaProvider,
  AppModeProvider,
  InitialCacheHydrationContext,
  SessionProvider,
  TestModeProvider,
  useSession,
} from '@/providers';
import { BiometricLockOverlay } from '@/components/auth/BiometricLockOverlay';
import { useBiometricUnlock } from '@/hooks/useBiometricUnlock';
import { financialPeriodSnapshotCache } from '@/services/finance/FinancialPeriodSnapshotCache';
import { firestoreClientDataSource } from '@/services/clients';
import { retailCategoryDataSource, retailProductDataSource } from '@/services/retail-catalog';
import {
  retailCompositionDataSource,
  retailCostEntryDataSource,
  retailCostItemDataSource,
} from '@/services/retail-costs';
import { retailClientDataSource } from '@/services/retail-clients';
import { retailOrderDataSource, retailPaymentDataSource } from '@/services/retail-orders';
import { firestoreDeliveryDataSource } from '@/services/deliveries';
import { firestoreFactoryReceiptDataSource } from '@/services/factory-purchases';
import { locationTrackingService, routeTrackingRepository } from '@/services/routes';
import { stockPeriodSnapshotCache } from '@/services/stock/StockPeriodSnapshotCache';
import { ThemeProvider, useAppTheme } from '@/theme';
import { QuickActionRouter } from '@/features/quick-actions/QuickActionRouter';
import { RetailOrderFlowProvider } from '@/features/retail-orders/components/RetailOrderFlowProvider';

void SplashScreen.preventAutoHideAsync();

function AppShell() {
  const { sessionVersion, status, user } = useSession();
  const { resolvedMode, theme } = useAppTheme();
  const pathname = usePathname();
  const isAuthenticated = status === 'authenticated' && Boolean(user?.id);
  const isSessionLoading = status === 'loading';
  const isStartupRoute = pathname === '/';
  const sessionUid = isAuthenticated ? user?.id : undefined;
  const sessionKey = isAuthenticated && user?.id ? `${sessionVersion}:${user.id}` : null;
  const [hydratedSessionKey, setHydratedSessionKey] = useState<string | null>(null);
  const isCacheHydrated =
    status === 'loading'
      ? false
      : status !== 'authenticated' || !user?.id
        ? true
        : hydratedSessionKey === sessionKey;
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
    routeTrackingRepository.setSessionUser(sessionUid, sessionVersion);
    firestoreClientDataSource.setSessionUser(sessionUid, sessionVersion);
    retailCategoryDataSource.setSessionUser(sessionUid, sessionVersion);
    retailClientDataSource.setSessionUser(sessionUid, sessionVersion);
    retailProductDataSource.setSessionUser(sessionUid, sessionVersion);
    retailCostItemDataSource.setSessionUser(sessionUid, sessionVersion);
    retailCostEntryDataSource.setSessionUser(sessionUid, sessionVersion);
    retailCompositionDataSource.setSessionUser(sessionUid, sessionVersion);
    retailOrderDataSource.setSessionUser(sessionUid, sessionVersion);
    retailPaymentDataSource.setSessionUser(sessionUid, sessionVersion);
    firestoreDeliveryDataSource.setSessionUser(sessionUid, sessionVersion);
    firestoreFactoryReceiptDataSource.setSessionUser(sessionUid, sessionVersion);
  }, [sessionUid, sessionVersion]);

  useEffect(() => {
    let active = true;

    if (status !== 'authenticated' || !user?.id) {
      return () => {
        active = false;
      };
    }

    void Promise.allSettled([
      firestoreClientDataSource.hydrateFromCache(user.id),
      firestoreDeliveryDataSource.hydrateFromCache(user.id),
      Font.loadAsync(Ionicons.font),
    ]).finally(() => {
      if (active) setHydratedSessionKey(sessionKey);
    });

    return () => {
      active = false;
    };
  }, [sessionKey, status, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !sessionUid) return;

    let active = true;
    void Promise.all([
      locationTrackingService.restoreActiveRouteAfterAppRestart(),
      routeTrackingRepository.getRouteHistory(),
    ]).catch((error) => {
      if (active && __DEV__) {
        console.warn('[RouteTracking] Falha ao restaurar dados locais de rotas.', error);
      }
    });

    return () => {
      active = false;
    };
  }, [isAuthenticated, sessionKey, sessionUid]);

  useEffect(() => {
    if (!sessionUid) return;
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    void financialPeriodSnapshotCache.read(sessionUid, currentMonth);
    void stockPeriodSnapshotCache.read(sessionUid, currentMonth);
  }, [sessionKey, sessionUid]);

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
                  options={
                    Platform.OS === 'ios'
                      ? {
                          gestureEnabled: false,
                          headerShadowVisible: false,
                          headerShown: true,
                          headerTitle: '',
                          headerTransparent: true,
                          unstable_nativeProps: {
                            headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                          },
                        }
                      : {
                          gestureEnabled: false,
                          headerShown: false,
                        }
                  }
                />
                <Stack.Screen
                  name="registrar-pedido-varejo/index"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      hidesBottomBarWhenPushed: true,
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="registrar-pedido-varejo/produtos"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerBackButtonMenuEnabled: false,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      hidesBottomBarWhenPushed: true,
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="default" withMenu={false}>
                    Voltar
                  </Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="registrar-pedido-varejo/detalhes"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerBackButtonMenuEnabled: false,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      hidesBottomBarWhenPushed: true,
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="default" withMenu={false}>
                    Voltar
                  </Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="registrar-pedido-varejo/resumo"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerBackButtonMenuEnabled: false,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      hidesBottomBarWhenPushed: true,
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="default" withMenu={false}>
                    Voltar
                  </Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="registrar-pedido-varejo/pagamento"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerBackButtonMenuEnabled: false,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      hidesBottomBarWhenPushed: true,
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="default" withMenu={false}>
                    Voltar
                  </Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="pedido-varejo/[orderId]"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerBackButtonMenuEnabled: false,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      hidesBottomBarWhenPushed: true,
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="default" withMenu={false}>
                    Voltar
                  </Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="pedido-varejo/[orderId]/editar"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerBackButtonMenuEnabled: false,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      hidesBottomBarWhenPushed: true,
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="default" withMenu={false}>
                    Voltar
                  </Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="registrar-entrega"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="registrar-dados"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="em-aberto"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="notas-fiscais-boletos"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="fabrica-compras"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="pesquisa"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="(home-shortcuts)"
                  options={{ gestureEnabled: true, headerShown: false }}
                />
                <Stack.Screen
                  name="faturamento-mensal"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="lucro-liquido-mensal"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="clientes"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="clientes/[clientId]"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerBackButtonMenuEnabled: false,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="clientes-varejo"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="clientes-varejo/[clientId]"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerBackButtonMenuEnabled: false,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="catalogo-varejo"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="catalogo-varejo/[categoryId]"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerBackButtonMenuEnabled: false,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="custos-varejo"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="custos-varejo/[costItemId]"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerBackButtonMenuEnabled: false,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="dados-empresa"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="fabrica"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="fabrica-valor-balde"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="fabrica-compras-menu"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="fabrica-compras-registrar"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="dados"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="dados/mensais"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="dados/diarios"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="dados/carro"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="localizacao"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="localizacao/[routeId]"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="estoque"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="face-id"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="sistema"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
                <Stack.Screen
                  name="modo-teste"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="backup"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
                </Stack.Screen>
                <Stack.Screen
                  name="pagamentos-em-aberto"
                  options={{
                    animation: 'default',
                    gestureEnabled: true,
                    headerShadowVisible: false,
                    headerShown: true,
                    headerTitle: '',
                    headerTransparent: true,
                    unstable_nativeProps: {
                      headerConfig: { experimental_userInterfaceStyle: resolvedMode },
                    },
                  }}
                >
                  <Stack.Screen.BackButton displayMode="minimal" />
                </Stack.Screen>
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
            <AppModeProvider>
              <ThemeProvider>
                <TestModeProvider>
                  <RetailOrderFlowProvider>
                    <AppShell />
                  </RetailOrderFlowProvider>
                </TestModeProvider>
              </ThemeProvider>
            </AppModeProvider>
          </SessionProvider>
        </AppSafeAreaProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
