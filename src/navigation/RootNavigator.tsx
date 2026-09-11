import {
  DefaultTheme,
  NavigationContainer,
  type LinkingOptions,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Linking } from 'react-native';

import { getAppScheme } from '@/config';
import { useAppTheme } from '@/theme';
import { useAuth } from '@/providers';
import { notificationService } from '@/services/notifications';

import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { NavigationPlaceholder } from './NavigationPlaceholder';
import { DesignSystemShowcase, PremiumTabBarShowcase } from '@/screens/dev';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const appScheme = getAppScheme();
const appSchemePrefixes = [
  `${appScheme}://`,
  ...(appScheme === 'pareact' ? [] : ['pareact://']),
];

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    ...appSchemePrefixes,
    'https://venda-e-faturamento.web.app',
    'http://localhost',
    'http://127.0.0.1',
  ],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
        },
      },
      MainTabs: {
        screens: {
          Dashboard: 'dashboard',
          Financeiro: 'financas',
          Registrar: 'registrar',
          Historico: 'historico',
        },
      },
      Modal: 'modal',
      DesignSystemShowcase: 'dev/design-system',
      PremiumTabBarShowcase: 'dev/premium-tab-bar',
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
              <>
                <Stack.Screen name="DesignSystemShowcase" component={DesignSystemShowcase} />
                <Stack.Screen name="PremiumTabBarShowcase" component={PremiumTabBarShowcase} />
              </>
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
