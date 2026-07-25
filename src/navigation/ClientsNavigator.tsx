import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  ClientDeleteReview,
  ClientDetails,
  ClientDeliveries,
  ClientForm,
  ClientPayments,
  ClientRenameReview,
  ClientsHome,
} from '@/screens/clients';

import type { ClientsStackParamList } from './types';

const Stack = createNativeStackNavigator<ClientsStackParamList>();

export function ClientsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen component={ClientsHome} name="ClientsHome" />
      <Stack.Screen component={ClientDetails} name="ClientDetails" />
      <Stack.Screen component={ClientForm} name="ClientForm" options={{ presentation: 'modal' }} />
      <Stack.Screen component={ClientRenameReview} name="ClientRenameReview" />
      <Stack.Screen component={ClientDeleteReview} name="ClientDeleteReview" />
      <Stack.Screen component={ClientDeliveries} name="ClientDeliveries" />
      <Stack.Screen component={ClientPayments} name="ClientPayments" />
    </Stack.Navigator>
  );
}
