import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform, useColorScheme } from 'react-native';

type IoniconName = keyof typeof Ionicons.glyphMap;

function icon(name: IoniconName, sf: 'house' | 'chart.bar' | 'plus' | 'clock', color: string) {
  if (Platform.OS === 'ios') {
    return { sf };
  }

  return { src: Ionicons.getImageSource(name, 24, color) };
}

function selectedIcon(
  name: IoniconName,
  sf: 'house.fill' | 'chart.bar.fill' | 'plus.circle.fill' | 'clock.fill',
  color: string,
) {
  if (Platform.OS === 'ios') {
    return { sf };
  }

  return { src: Ionicons.getImageSource(name, 24, color) };
}

export default function PrototypeTabsLayout() {
  const colorScheme = useColorScheme();
  const iconColor = colorScheme === 'dark' ? '#FFFFFF' : '#000000';

  return (
    <NativeTabs>
      <NativeTabs.Trigger
        name="dashboard"
        options={{
          title: 'Dashboard',
          icon: icon('home-outline', 'house', iconColor),
          selectedIcon: selectedIcon('home', 'house.fill', iconColor),
        }}
      />
      <NativeTabs.Trigger
        name="financeiro"
        options={{
          title: 'Finanças',
          icon: icon('bar-chart-outline', 'chart.bar', iconColor),
          selectedIcon: selectedIcon('bar-chart', 'chart.bar.fill', iconColor),
        }}
      />
      <NativeTabs.Trigger
        name="registrar"
        options={{
          title: 'Registrar',
          icon: icon('add-outline', 'plus', iconColor),
          selectedIcon: selectedIcon('add-circle', 'plus.circle.fill', iconColor),
        }}
      />
      <NativeTabs.Trigger
        name="historico"
        options={{
          title: 'Histórico',
          icon: icon('time-outline', 'clock', iconColor),
          selectedIcon: selectedIcon('time', 'clock.fill', iconColor),
        }}
      />
    </NativeTabs>
  );
}
