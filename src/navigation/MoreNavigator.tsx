import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  BackupScreen,
  HistoryRankingScreen,
  HistoryScreen,
  MoreHomeScreen,
  NotificationSettingsScreen,
  SettingsScreen,
} from '@/screens/more';
import type { MoreStackParamList } from './types';

const Stack = createNativeStackNavigator<MoreStackParamList>();

export function MoreNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen component={MoreHomeScreen} name="MoreHome" />
      <Stack.Screen component={HistoryScreen} name="History" />
      <Stack.Screen component={HistoryRankingScreen} name="HistoryRanking" />
      <Stack.Screen component={SettingsScreen} name="MoreSettings" />
      <Stack.Screen component={BackupScreen} name="MoreBackup" />
      <Stack.Screen component={NotificationSettingsScreen} name="MoreNotifications" />
    </Stack.Navigator>
  );
}
