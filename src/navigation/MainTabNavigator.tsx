import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { ComponentProps } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';

import { ClientsNavigator } from './ClientsNavigator';
import { DeliveriesNavigator } from './DeliveriesNavigator';
import { DashboardNavigator } from './DashboardNavigator';
import { FinanceNavigator } from './FinanceNavigator';
import { MoreNavigator } from './MoreNavigator';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

type TabIconName = ComponentProps<typeof Ionicons>['name'];

export function MainTabNavigator() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { colors, typography, borders, spacing, icons, layout, sizes } = theme;
  const tabIcons: Record<keyof MainTabParamList, { focused: TabIconName; unfocused: TabIconName }> =
    {
      Dashboard: {
        focused: icons.tabBar.home.active,
        unfocused: icons.tabBar.home.inactive,
      },
      Financeiro: {
        focused: icons.tabBar.finance.active,
        unfocused: icons.tabBar.finance.inactive,
      },
      Clientes: {
        focused: icons.tabBar.clients.active,
        unfocused: icons.tabBar.clients.inactive,
      },
      Entregas: {
        focused: icons.tabBar.deliveries.active,
        unfocused: icons.tabBar.deliveries.inactive,
      },
      Mais: {
        focused: icons.tabBar.settings.active,
        unfocused: icons.tabBar.settings.inactive,
      },
    };

  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarIcon: ({ focused, color, size }) => {
          const icon = tabIcons[route.name];

          return (
            <Ionicons name={focused ? icon.focused : icon.unfocused} size={size} color={color} />
          );
        },
        tabBarLabelStyle: {
          ...typography.caption,
          marginBottom: spacing.xxs,
        },
        tabBarItemStyle: { minHeight: sizes.touchTargetMinimum },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.separator,
          borderTopWidth: borders.width.hairline,
          height: layout.tabBarHeight + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: spacing.xs,
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardNavigator} options={{ title: 'Início' }} />
      <Tab.Screen
        name="Financeiro"
        component={FinanceNavigator}
        options={{ title: 'Financeiro' }}
      />
      <Tab.Screen name="Clientes" component={ClientsNavigator} options={{ title: 'Clientes' }} />
      <Tab.Screen name="Entregas" component={DeliveriesNavigator} options={{ title: 'Entregas' }} />
      <Tab.Screen name="Mais" component={MoreNavigator} options={{ title: 'Mais' }} />
    </Tab.Navigator>
  );
}
