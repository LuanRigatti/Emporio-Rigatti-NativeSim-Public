import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  DashboardDeliveryRecordsScreen,
  DashboardIndicatorDetailsScreen,
  DashboardScreen,
} from '@/screens/dashboard';

import type { DashboardStackParamList } from './types';

const Stack = createNativeStackNavigator<DashboardStackParamList>();

export function DashboardNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen component={DashboardScreen} name="HomeDashboard" />
      <Stack.Screen component={DashboardIndicatorDetailsScreen} name="DashboardIndicatorDetails" />
      <Stack.Screen component={DashboardDeliveryRecordsScreen} name="DashboardDeliveryRecords" />
    </Stack.Navigator>
  );
}
