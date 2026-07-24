import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { ComponentProps } from 'react';

import { useAppTheme } from '@/theme';

import { NavigationPlaceholder } from './NavigationPlaceholder';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

type TabIconName = ComponentProps<typeof Ionicons>['name'];

function HomePlaceholderScreen() {
  return <NavigationPlaceholder title="Início" routeName="Home" />;
}

function FinancePlaceholderScreen() {
  return <NavigationPlaceholder title="Financeiro" routeName="Financeiro" />;
}

function ClientsPlaceholderScreen() {
  return <NavigationPlaceholder title="Clientes" routeName="Clientes" />;
}

function DeliveriesPlaceholderScreen() {
  return <NavigationPlaceholder title="Entregas" routeName="Entregas" />;
}

function SettingsPlaceholderScreen() {
  return <NavigationPlaceholder title="Ajustes" routeName="Configuracoes" />;
}

export function MainTabNavigator() {
  const { theme } = useAppTheme();
  const { colors, typography, borders, spacing, icons, layout } = theme;
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
      Configuracoes: {
        focused: icons.tabBar.settings.active,
        unfocused: icons.tabBar.settings.inactive,
      },
    };

  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        headerShown: false,
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
          marginBottom: 2,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.separator,
          borderTopWidth: borders.width.hairline,
          height: layout.tabBarHeight,
          paddingTop: spacing.xs,
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={HomePlaceholderScreen}
        options={{ title: 'Início' }}
      />
      <Tab.Screen
        name="Financeiro"
        component={FinancePlaceholderScreen}
        options={{ title: 'Financeiro' }}
      />
      <Tab.Screen
        name="Clientes"
        component={ClientsPlaceholderScreen}
        options={{ title: 'Clientes' }}
      />
      <Tab.Screen
        name="Entregas"
        component={DeliveriesPlaceholderScreen}
        options={{ title: 'Entregas' }}
      />
      <Tab.Screen
        name="Configuracoes"
        component={SettingsPlaceholderScreen}
        options={{ title: 'Ajustes' }}
      />
    </Tab.Navigator>
  );
}
