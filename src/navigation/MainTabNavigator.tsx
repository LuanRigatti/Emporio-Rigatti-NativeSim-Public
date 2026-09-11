import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import {
  PremiumDashboardPlaceholder,
  PremiumFinancePlaceholder,
  PremiumHistoryPlaceholder,
  PremiumRegisterPlaceholder,
} from '@/screens/premium';

import { PremiumTabBar } from './PremiumTabBar';
import type { PremiumMainTabParamList } from './types';

const Tab = createBottomTabNavigator<PremiumMainTabParamList>();

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      tabBar={(props) => <PremiumTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        animation: 'fade',
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
        },
      }}
    >
      <Tab.Screen name="Dashboard" component={PremiumDashboardPlaceholder} />
      <Tab.Screen
        name="Financeiro"
        component={PremiumFinancePlaceholder}
        options={{ title: 'Finanças' }}
      />
      <Tab.Screen name="Registrar" component={PremiumRegisterPlaceholder} />
      <Tab.Screen
        name="Historico"
        component={PremiumHistoryPlaceholder}
        options={{ title: 'Histórico' }}
      />
    </Tab.Navigator>
  );
}
