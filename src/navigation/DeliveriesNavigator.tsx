import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  DeliveriesHome,
  DeliveryBulkEdit,
  DeliveryDetails,
  DeliveryForm,
  DeliverySettlement,
} from '@/screens/deliveries';
import { RouteAddressCorrectionScreen, RouteDayScreen, RouteMapScreen } from '@/screens/routes';

import type { DeliveriesStackParamList } from './types';

const Stack = createNativeStackNavigator<DeliveriesStackParamList>();

export function DeliveriesNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen component={DeliveriesHome} name="DeliveriesHome" />
      <Stack.Screen component={DeliveryDetails} name="DeliveryDetails" />
      <Stack.Screen
        component={DeliveryForm}
        name="NewDelivery"
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        component={DeliveryForm}
        name="EditDelivery"
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        component={DeliveryBulkEdit}
        name="DeliveryBulkEdit"
        options={{ presentation: 'transparentModal' }}
      />
      <Stack.Screen
        component={DeliverySettlement}
        name="DeliverySettlement"
        options={{ presentation: 'transparentModal' }}
      />
      <Stack.Screen component={RouteDayScreen} name="RouteDay" />
      <Stack.Screen component={RouteMapScreen} name="RouteMap" />
      <Stack.Screen
        component={RouteAddressCorrectionScreen}
        name="RouteAddressCorrection"
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
