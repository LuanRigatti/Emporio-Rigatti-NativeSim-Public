import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform, useColorScheme } from 'react-native';

type IoniconName = keyof typeof Ionicons.glyphMap;
type FontAwesome6IconName = keyof typeof FontAwesome6.glyphMap;

function icon(
  name: IoniconName,
  sf: 'house' | 'house.fill' | 'chart.bar' | 'plus' | 'clock',
  color: string,
) {
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

function homeIcon(color: string) {
  const name: FontAwesome6IconName = 'house';
  return { src: FontAwesome6.getImageSource(name, 24, color) };
}

export default function PrototypeTabsLayout() {
  const colorScheme = useColorScheme();
  const iconColor = colorScheme === 'dark' ? '#FFFFFF' : '#000000';

  return (
    <NativeTabs labelVisibilityMode="unlabeled" tintColor={iconColor}>
      <NativeTabs.Trigger
        name="dashboard"
        options={{
          title: 'Home',
          icon: homeIcon(iconColor),
          selectedIcon: homeIcon(iconColor),
        }}
      >
        <Label hidden />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="financeiro"
        options={{
          title: 'Finanças',
          icon: icon('bar-chart-outline', 'chart.bar', iconColor),
          selectedIcon: selectedIcon('bar-chart', 'chart.bar.fill', iconColor),
        }}
      >
        <Label hidden />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="registrar"
        options={{
          title: 'Registrar',
          icon: icon('add-outline', 'plus', iconColor),
          selectedIcon: selectedIcon('add-circle', 'plus.circle.fill', iconColor),
        }}
      >
        <Label hidden />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="historico"
        options={{
          title: 'Histórico',
          icon: icon('time-outline', 'clock', iconColor),
          selectedIcon: selectedIcon('time', 'clock.fill', iconColor),
        }}
      >
        <Label hidden />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
