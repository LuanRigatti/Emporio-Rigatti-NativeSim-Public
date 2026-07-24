import {
  DefaultTheme,
  NavigationContainer,
  type LinkingOptions,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAppTheme } from '@/theme';

import { MainTabNavigator } from './MainTabNavigator';
import { NavigationPlaceholder } from './NavigationPlaceholder';
import { DesignSystemShowcase } from '@/screens/dev';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const developmentLinking: LinkingOptions<RootStackParamList> = {
  prefixes: [],
  config: {
    screens: {
      MainTabs: '',
      Modal: 'modal',
      DesignSystemShowcase: 'dev/design-system',
    },
  },
};

export function NavigationRoot() {
  const { theme, resolvedMode } = useAppTheme();
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
    <NavigationContainer theme={navigationTheme} linking={__DEV__ ? developmentLinking : undefined}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        <Stack.Screen
          name="Modal"
          component={NavigationPlaceholder}
          options={{ presentation: 'modal' }}
        />
        {__DEV__ ? (
          <Stack.Screen name="DesignSystemShowcase" component={DesignSystemShowcase} />
        ) : null}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
