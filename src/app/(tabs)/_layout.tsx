import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform, useColorScheme } from 'react-native';

type IoniconName = keyof typeof Ionicons.glyphMap;

function icon(
  name: IoniconName,
  sf: 'house' | 'chart.bar' | 'plus.circle' | 'clock' | 'gearshape',
  selectedSf:
    'house.fill' | 'chart.bar.fill' | 'plus.circle.fill' | 'clock.fill' | 'gearshape.fill',
  color: string,
) {
  return {
    sf: { default: sf, selected: selectedSf },
    src: Platform.OS === 'ios' ? undefined : Ionicons.getImageSource(name, 24, color),
  };
}

export default function PrototypeTabsLayout() {
  return <TabsNavigator />;
}

function TabsNavigator() {
  const colorScheme = useColorScheme();
  const iconColor = colorScheme === 'dark' ? '#FFFFFF' : '#000000';

  return (
    <NativeTabs labelVisibilityMode="unlabeled" tintColor={iconColor}>
      <NativeTabs.Trigger name="dashboard">
        <NativeTabs.Trigger.Icon {...icon('home-outline', 'house', 'house.fill', iconColor)} />
        <NativeTabs.Trigger.Label hidden>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="financeiro">
        <NativeTabs.Trigger.Icon
          {...icon('bar-chart-outline', 'chart.bar', 'chart.bar.fill', iconColor)}
        />
        <NativeTabs.Trigger.Label hidden>Finanças</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="registrar">
        <NativeTabs.Trigger.Icon
          {...icon('add-outline', 'plus.circle', 'plus.circle.fill', iconColor)}
        />
        <NativeTabs.Trigger.Label hidden>Registrar</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="historico">
        <NativeTabs.Trigger.Icon {...icon('time-outline', 'clock', 'clock.fill', iconColor)} />
        <NativeTabs.Trigger.Label hidden>Histórico</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="configuracoes">
        <NativeTabs.Trigger.Icon
          {...icon('settings-outline', 'gearshape', 'gearshape.fill', iconColor)}
        />
        <NativeTabs.Trigger.Label hidden>Configurações</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
