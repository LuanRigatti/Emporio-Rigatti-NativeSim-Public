import {
  DefaultTheme,
  NavigationContainer,
  type LinkingOptions,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Linking } from 'react-native';

import { useAppTheme } from '@/theme';
import { useAuth } from '@/providers';
import { notificationService } from '@/services/notifications';

import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { NavigationPlaceholder } from './NavigationPlaceholder';
import { DesignSystemShowcase } from '@/screens/dev';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['pareact://', 'https://venda-e-faturamento.web.app'],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
        },
      },
      MainTabs: {
        screens: {
          Dashboard: { screens: { HomeDashboard: 'dashboard' } },
          Entregas: {
            screens: {
              DeliveriesHome: 'entregas',
              DeliveryDetails: 'entregas/:deliveryId',
              RouteDay: 'rota',
            },
          },
          Clientes: { screens: { ClientsHome: 'clientes' } },
          Financeiro: { screens: { FinanceHome: 'financeiro' } },
          Mais: {
            screens: {
              MoreHome: 'mais',
              History: 'mais/historico',
              MoreNotifications: 'mais/notificacoes',
            },
          },
        },
      },
      Modal: 'modal',
      DesignSystemShowcase: 'dev/design-system',
    },
  },
  async getInitialURL() {
    const initialUrl = await Linking.getInitialURL();
    return initialUrl ?? notificationService.getInitialUrl();
  },
  subscribe(listener) {
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => listener(url));
    const notificationSubscription = notificationService.subscribeToResponse(listener);
    return () => {
      linkingSubscription.remove();
      notificationSubscription.remove();
    };
  },
};

export function NavigationRoot() {
  const { theme, resolvedMode } = useAppTheme();
  const { status } = useAuth();
  const { colors } = theme;
  const navigationTheme: Theme = {
    dark: resolvedMode === 'dark',
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.separator,
      notification: colors.danger,
    },
    fonts: DefaultTheme.fonts,
  };

  return (
    <NavigationContainer theme={navigationTheme} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {status === 'authenticated' ? (
          <Stack.Group navigationKey="authenticated">
            <Stack.Screen name="MainTabs" component={MainTabNavigator} />
            <Stack.Screen
              name="Modal"
              component={NavigationPlaceholder}
              options={{ presentation: 'modal' }}
            />
            {__DEV__ ? (
              <Stack.Screen name="DesignSystemShowcase" component={DesignSystemShowcase} />
            ) : null}
          </Stack.Group>
        ) : (
          <Stack.Group navigationKey="unauthenticated">
            <Stack.Screen name="Auth" component={AuthNavigator} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
