import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';

import { LargeTitleHeader, ListItem, ScrollScreen, Section } from '@/components';
import type { MainTabParamList, MoreStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreHome'>;

export function MoreHomeScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const tabs = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  return (
    <ScrollScreen>
      <LargeTitleHeader subtitle="Histórico, configurações e ferramentas" title="Mais" />
      <View style={{ padding: theme.spacing.md }}>
        <Section title="Registros">
          <ListItem
            leading={
              <Ionicons
                color={theme.colors.primary}
                name="time-outline"
                size={theme.sizes.iconMedium}
              />
            }
            onPress={() => navigation.navigate('History')}
            subtitle="Busque, filtre e edite entregas antigas"
            title="Histórico"
          />
        </Section>
        <Section title="Ferramentas">
          <ListItem
            leading={
              <Ionicons
                color={theme.colors.primary}
                name="map-outline"
                size={theme.sizes.iconMedium}
              />
            }
            onPress={() =>
              tabs?.navigate('Entregas', { screen: 'RouteDay', params: { source: 'more' } })
            }
            subtitle="Configure origem, paradas e destino final"
            title="Rota do dia"
          />
          <ListItem
            leading={
              <Ionicons
                color={theme.colors.primary}
                name="settings-outline"
                size={theme.sizes.iconMedium}
              />
            }
            onPress={() => navigation.navigate('MoreSettings')}
            title="Configurações"
          />
          <ListItem
            leading={
              <Ionicons
                color={theme.colors.primary}
                name="archive-outline"
                size={theme.sizes.iconMedium}
              />
            }
            onPress={() => navigation.navigate('MoreBackup')}
            title="Backup"
          />
          <ListItem
            leading={
              <Ionicons
                color={theme.colors.primary}
                name="notifications-outline"
                size={theme.sizes.iconMedium}
              />
            }
            onPress={() => navigation.navigate('MoreNotifications')}
            title="Notificações"
          />
        </Section>
      </View>
    </ScrollScreen>
  );
}
